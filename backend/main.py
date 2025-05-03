from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any, Union, Tuple
import numpy as np
from sklearn.decomposition import PCA
from sklearn.preprocessing import StandardScaler
import pandas as pd
from scipy.stats import pearsonr, spearmanr, kendalltau
from datetime import datetime, timedelta
from statsmodels.tsa.arima.model import ARIMA
from statsmodels.tsa.holtwinters import ExponentialSmoothing
from sklearn.linear_model import LinearRegression, Ridge, Lasso, LogisticRegression
from sklearn.preprocessing import PolynomialFeatures, LabelEncoder
from sklearn.pipeline import make_pipeline
from sklearn.metrics import mean_squared_error, confusion_matrix, classification_report, roc_auc_score, roc_curve
import scipy.stats as stats
from statsmodels.stats.outliers_influence import variance_inflation_factor
from openai import OpenAI
import os
from dotenv import load_dotenv
import json
import re

# Load environment variables from .env.local
load_dotenv(".env.local")

# Get API key from environment variable
openai_api_key = os.getenv("OPENAI_API_KEY")
if not openai_api_key:
    raise ValueError("OPENAI_API_KEY is not set in .env.local file")

# Initialize OpenAI client
openai = OpenAI(api_key=openai_api_key)

app = FastAPI()

# Configure CORS to allow requests from your frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://unifieddata.app",
        "https://www.unifieddata.app",
        "http://localhost:3000"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class MatrixData(BaseModel):
    matrix_a: List[List[float]]
    matrix_b: Optional[List[List[float]]] = None
    operation: str

class MatrixResult(BaseModel):
    result: Union[List[List[float]], List[float], float, Dict[str, Any]]
    result_type: str  # "matrix", "vector", "scalar", or "error"
    error: Optional[str] = None

class CorrelationData(BaseModel):
    data: List[List[Any]]
    columns: List[str]
    
# Data cleaning request model
class DataCleaningRequest(BaseModel):
    data: List[List[Any]]
    retry_feedback: Optional[str] = None

# Define data cleaning response model
class DataCleaningResponse(BaseModel):
    columns: List[Dict[str, Any]]
    summary: Dict[str, Any]
    suggestions: List[Dict[str, Any]]

# New data models for report generation
class SheetSelection(BaseModel):
    spreadsheet_id: str
    sheet_id: str
    sheet_name: str
    data: List[List[Any]]
    selected_columns: Optional[List[str]] = None
    data_range: Optional[Dict[str, int]] = None

class ReportConfig(BaseModel):
    data_quality: Optional[Dict[str, bool]] = Field(
        default_factory=lambda: {
            "missing_values": True,
            "type_detection": True,
            "anomaly_detection": True
        }
    )
    statistical_analysis: Optional[Dict[str, Any]] = Field(
        default_factory=lambda: {
            "correlation": True,
            "correlation_method": "pearson",
            "basic_stats": True
        }
    )
    predictive_analysis: Optional[Dict[str, Any]] = Field(
        default_factory=lambda: {
            "regression": False,
            "regression_type": "linear",
            "forecast": False,
            "forecast_periods": 7
        }
    )
    visualizations: Optional[List[Dict[str, Any]]] = Field(
        default_factory=list
    )
    ai_analysis: Optional[Dict[str, bool]] = Field(
        default_factory=lambda: {
            "trends": True,
            "insights": True,
            "recommendations": True
        }
    )

class ReportRequest(BaseModel):
    title: str
    description: Optional[str] = None
    selected_sheets: List[SheetSelection]
    config: ReportConfig
    user_id: str

class ReportSection(BaseModel):
    title: str
    content: Dict[str, Any]
    visualizations: Optional[List[Dict[str, Any]]] = None
    insights: Optional[List[str]] = None
    progress_updates: Optional[List[Dict[str, Any]]] = None

class ReportResponse(BaseModel):
    report_id: str
    title: str
    description: Optional[str]
    created_at: datetime
    sections: List[ReportSection]
    summary: Dict[str, Any]
    status: str = "completed"
    error: Optional[str] = None

@app.post("/matrix-operations")
async def perform_matrix_operation(data: MatrixData):
    try:
        # Convert to numpy arrays
        matrix_a = np.array(data.matrix_a, dtype=np.float64)
        
        if data.operation in ["add", "subtract", "multiply"] and data.matrix_b is not None:
            matrix_b = np.array(data.matrix_b, dtype=np.float64)
        
        result = None
        result_type = "matrix"
        
        # Perform requested operation
        if data.operation == "add":
            if matrix_a.shape != matrix_b.shape:
                raise ValueError("Matrices must have the same dimensions for addition")
            result = matrix_a + matrix_b
            
        elif data.operation == "subtract":
            if matrix_a.shape != matrix_b.shape:
                raise ValueError("Matrices must have the same dimensions for subtraction")
            result = matrix_a - matrix_b
            
        elif data.operation == "multiply":
            if matrix_a.shape[1] != matrix_b.shape[0]:
                raise ValueError(f"Matrix dimensions incompatible for multiplication: {matrix_a.shape} and {matrix_b.shape}")
            result = np.matmul(matrix_a, matrix_b)
            
        elif data.operation == "transpose":
            result = matrix_a.T
            
        elif data.operation == "determinant":
            if matrix_a.shape[0] != matrix_a.shape[1]:
                raise ValueError("Matrix must be square for determinant calculation")
            det_value = np.linalg.det(matrix_a)
            return MatrixResult(result=float(det_value), result_type="scalar", error=None)
            
        elif data.operation == "inverse":
            if matrix_a.shape[0] != matrix_a.shape[1]:
                raise ValueError("Matrix must be square for inverse calculation")
            result = np.linalg.inv(matrix_a)
            
        elif data.operation == "eigenvalues":
            if matrix_a.shape[0] != matrix_a.shape[1]:
                raise ValueError("Matrix must be square for eigenvalue calculation")
            eigenvalues = np.linalg.eigvals(matrix_a)
            # Convert complex eigenvalues to format that can be JSON serialized
            eigenvalues_list = [{"real": float(val.real), "imag": float(val.imag)} 
                               for val in eigenvalues]
            return MatrixResult(result=eigenvalues_list, result_type="vector", error=None)
            
        elif data.operation == "pca":
            # PCA requires standardized input
            scaler = StandardScaler()
            standardized_data = scaler.fit_transform(matrix_a)
            
            # Number of components - default to min(n_samples, n_features) or 2, whichever is smaller
            n_components = min(min(matrix_a.shape), 2)
            
            # Run PCA
            pca = PCA(n_components=n_components)
            principal_components = pca.fit_transform(standardized_data)
            
            # Return both the transformed data and the explained variance
            return {
                "result": principal_components.tolist(),
                "explained_variance": pca.explained_variance_ratio_.tolist(),
                "components": pca.components_.tolist(),
                "result_type": "pca"
            }
            
        elif data.operation == "correlation":
            # Check if we have enough numeric data
            if matrix_a.shape[1] < 2:
                raise ValueError("Need at least 2 columns for correlation analysis")
            
            # Calculate the correlation matrix
            corr_matrix = np.corrcoef(matrix_a, rowvar=False)
            
            return {
                "result": corr_matrix.tolist(),
                "result_type": "matrix"
            }
            
        elif data.operation == "svd":
            # Perform SVD
            U, S, Vt = np.linalg.svd(matrix_a, full_matrices=False)
            
            return {
                "U": U.tolist(),  # Left singular vectors
                "S": S.tolist(),  # Singular values
                "Vt": Vt.tolist(),  # Right singular vectors (transposed)
                "result_type": "svd"
            }
            
        else:
            raise ValueError(f"Unsupported operation: {data.operation}")
        
        # Convert result to list for JSON serialization
        result_list = result.tolist()
        return MatrixResult(result=result_list, result_type=result_type, error=None)
        
    except Exception as e:
        return MatrixResult(result=[], result_type="error", error=str(e))

# Add a health check endpoint
@app.get("/health")
async def health_check():
    return {"status": "healthy"}

# Add this new endpoint to your FastAPI Python backend
@app.post("/correlation")
async def perform_correlation(data: dict):
    try:
        if "data" in data:
            matrix = np.array(data["data"], dtype=np.float64)
        elif "matrix" in data:
            matrix = np.array(data["matrix"], dtype=np.float64)
        else:
            return {"error": "Missing required data fields"}
        
        # Get correlation method from request, default to pearson
        method = data.get("method", "pearson").lower()
        
        # Convert to pandas DataFrame for easier correlation calculation
        df = pd.DataFrame(matrix)
        
        # Calculate correlation matrix using the specified method
        if method == "pearson":
            corr_matrix = df.corr(method='pearson').values
            # Calculate p-values for Pearson correlation
            p_values = np.zeros(corr_matrix.shape)
            n = matrix.shape[0]
            
            for i in range(corr_matrix.shape[0]):
                for j in range(corr_matrix.shape[1]):
                    if i == j:
                        p_values[i, j] = 0.0
                    else:
                        try:
                            _, p_values[i, j] = pearsonr(matrix[:, i], matrix[:, j])
                        except:
                            p_values[i, j] = np.nan
        
        elif method == "spearman":
            corr_matrix = df.corr(method='spearman').values
            # Calculate p-values for Spearman correlation
            p_values = np.zeros(corr_matrix.shape)
            
            for i in range(corr_matrix.shape[0]):
                for j in range(corr_matrix.shape[1]):
                    if i == j:
                        p_values[i, j] = 0.0
                    else:
                        try:
                            _, p_values[i, j] = spearmanr(matrix[:, i], matrix[:, j])
                        except:
                            p_values[i, j] = np.nan
        
        elif method == "kendall":
            corr_matrix = df.corr(method='kendall').values
            # Calculate p-values for Kendall correlation
            p_values = np.zeros(corr_matrix.shape)
            
            for i in range(corr_matrix.shape[0]):
                for j in range(corr_matrix.shape[1]):
                    if i == j:
                        p_values[i, j] = 0.0
                    else:
                        try:
                            _, p_values[i, j] = kendalltau(matrix[:, i], matrix[:, j])
                        except:
                            p_values[i, j] = np.nan
        
        else:
            return {"error": f"Unsupported correlation method: {method}"}
        
        return {
            "matrix": corr_matrix.tolist(),
            "p_values": p_values.tolist(),
            "method": method
        }
    except Exception as e:
        print("Error in correlation:", str(e))
        return {"error": str(e)}

@app.post("/correlation-analysis")
async def perform_correlation_analysis(data: CorrelationData):
    try:
        # Convert to pandas DataFrame for easier handling
        df = pd.DataFrame(data.data, columns=data.columns)
        
        # Filter only numeric columns
        numeric_cols = df.select_dtypes(include=['number']).columns.tolist()
        
        if len(numeric_cols) < 2:
            raise ValueError("Need at least 2 numeric columns for correlation analysis")
        
        # Calculate correlation matrix
        corr_matrix = df[numeric_cols].corr(method='pearson').round(3)
        
        # Calculate p-values for each correlation pair
        p_values = {}
        for i, col1 in enumerate(numeric_cols):
            p_values[col1] = {}
            for col2 in numeric_cols:
                if col1 != col2:
                    # Calculate Pearson correlation and p-value
                    valid_data = df[[col1, col2]].dropna()
                    if len(valid_data) > 1:  # Need at least 2 data points
                        corr, p_val = pearsonr(valid_data[col1], valid_data[col2])
                        p_values[col1][col2] = round(p_val, 4)
                    else:
                        p_values[col1][col2] = None
                else:
                    p_values[col1][col2] = 0.0  # p-value for self correlation is 0
        
        # Interpret correlations
        interpretations = {}
        for col1 in numeric_cols:
            interpretations[col1] = {}
            for col2 in numeric_cols:
                if col1 != col2:
                    corr_value = corr_matrix.loc[col1, col2]
                    p_value = p_values[col1][col2]
                    
                    # Skip if p-value is None (not enough data)
                    if p_value is None:
                        interpretations[col1][col2] = "Insufficient data"
                        continue
                    
                    # Interpret correlation strength
                    if abs(corr_value) < 0.3:
                        strength = "weak"
                    elif abs(corr_value) < 0.7:
                        strength = "moderate"
                    else:
                        strength = "strong"
                    
                    # Interpret statistical significance
                    significance = "statistically significant" if p_value < 0.05 else "not statistically significant"
                    
                    # Direction
                    direction = "positive" if corr_value > 0 else "negative"
                    
                    interpretations[col1][col2] = f"{strength} {direction} correlation ({significance}, p={p_value})"
        
        return {
            "correlation_matrix": corr_matrix.to_dict(),
            "p_values": p_values,
            "interpretations": interpretations,
            "numeric_columns": numeric_cols
        }
        
    except Exception as e:
        return {"error": str(e)}

@app.post("/forecast")
async def forecast_time_series(data: dict):
    try:
        # Parse input data
        time_series = data.get("data", [])
        periods = data.get("periods", 7)
        method = data.get("method", "auto")
        seasonality = data.get("seasonality", "auto")
        
        if not time_series:
            return {"error": "No time series data provided"}
        
        # Convert to pandas DataFrame
        df = pd.DataFrame(time_series)
        df['date'] = pd.to_datetime(df['date'])
        df = df.sort_values('date')
        
        # Check if we have enough data
        if len(df) < 10:
            return {"error": "Need at least 10 data points for forecasting"}
        
        # Determine seasonality if auto
        if seasonality == "auto":
            # Simple seasonality detection logic
            # Check for weekly patterns
            if len(df) >= 14:
                autocorr_7 = np.corrcoef(df['value'][:-7], df['value'][7:])[0, 1]
                if autocorr_7 > 0.6:
                    seasonality = 7
            # Check for monthly patterns
            if len(df) >= 24:
                autocorr_12 = np.corrcoef(df['value'][:-12], df['value'][12:])[0, 1]
                if autocorr_12 > 0.6:
                    seasonality = 12
            # Default: no seasonality
            if seasonality == "auto":
                seasonality = None
        elif seasonality == "0":
            seasonality = None
        else:
            seasonality = int(seasonality)
        
        # Determine forecast dates
        last_date = df['date'].iloc[-1]
        date_diff = df['date'].iloc[-1] - df['date'].iloc[-2]
        
        forecast_dates = []
        for i in range(1, periods + 1):
            forecast_dates.append((last_date + i * date_diff).strftime('%Y-%m-%d'))
        
        # Select forecasting method
        if method == "auto":
            # Simple logic to select method based on data characteristics
            if seasonality and len(df) >= 2 * seasonality:
                method = "ets"  # Exponential smoothing for seasonal data
            else:
                method = "arima"  # ARIMA for non-seasonal data
        
        forecast_values = []
        forecast_lower = []
        forecast_upper = []
        
        # Perform forecasting
        if method == "arima":
            # ARIMA model
            # Use a simple auto ARIMA approach
            order = (1, 1, 1)  # Default p, d, q parameters
            
            model = ARIMA(df['value'], order=order)
            fitted_model = model.fit()
            
            # Generate forecast
            forecast = fitted_model.forecast(steps=periods)
            forecast_values = forecast.tolist()
            
            # Generate confidence intervals
            forecast_ci = fitted_model.get_forecast(steps=periods).conf_int(alpha=0.05)
            forecast_lower = forecast_ci.iloc[:, 0].tolist()
            forecast_upper = forecast_ci.iloc[:, 1].tolist()
            
            # Calculate error metrics
            mae = np.mean(np.abs(fitted_model.resid))
            mape = np.mean(np.abs(fitted_model.resid / df['value'])) * 100
            
        elif method == "ets":
            # Exponential Smoothing
            if seasonality:
                model = ExponentialSmoothing(
                    df['value'],
                    seasonal_periods=seasonality,
                    trend='add',
                    seasonal='add',
                    use_boxcox=False
                )
            else:
                model = ExponentialSmoothing(
                    df['value'],
                    trend='add',
                    seasonal=None,
                    use_boxcox=False
                )
                
            fitted_model = model.fit()
            
            # Generate forecast
            forecast = fitted_model.forecast(periods)
            forecast_values = forecast.tolist()
            
            # Simple confidence intervals (approximation)
            residuals = fitted_model.resid
            resid_std = residuals.std()
            forecast_lower = [v - 1.96 * resid_std for v in forecast_values]
            forecast_upper = [v + 1.96 * resid_std for v in forecast_values]
            
            # Calculate error metrics
            mae = np.mean(np.abs(residuals))
            mape = np.mean(np.abs(residuals / df['value'])) * 100
            
        elif method == "prophet":
            # Prophet requires the prophet package, fall back to ARIMA if not available
            return {"error": "Prophet method is not implemented in this simple example"}
        
        # Format results
        forecast_result = []
        for i in range(periods):
            forecast_result.append({
                "date": forecast_dates[i],
                "value": round(forecast_values[i], 4),
                "lower_bound": round(forecast_lower[i], 4),
                "upper_bound": round(forecast_upper[i], 4)
            })
        
        return {
            "forecast": forecast_result,
            "method": method,
            "mae": mae,
            "mape": mape,
            "seasonality": seasonality
        }
        
    except Exception as e:
        print(f"Forecast error: {str(e)}")
        return {"error": str(e)}

@app.post("/regression")
async def perform_regression(data: dict):
    try:
        # Parse input data
        y = np.array(data.get("dependent_variable", []))
        X_raw = np.array(data.get("independent_variables", []))
        column_names = data.get("column_names", [])
        regression_type = data.get("regression_type", "linear")
        polynomial_degree = data.get("polynomial_degree", 2)
        
        if len(y) == 0 or len(X_raw) == 0:
            raise HTTPException(status_code=400, detail="Missing dependent or independent variables")
        
        # Reshape X if it's a single feature
        if len(X_raw.shape) == 1:
            X = X_raw.reshape(-1, 1)
        else:
            X = X_raw
        
        # For logistic regression, check if dependent variable is binary
        if regression_type == "logistic":
            # Convert to numeric if not already
            unique_values = np.unique(y)
            if len(unique_values) != 2:
                raise HTTPException(
                    status_code=400, 
                    detail=f"Logistic regression requires a binary dependent variable. Found {len(unique_values)} unique values."
                )
            
            # Encode the dependent variable as 0/1 if needed
            label_encoder = LabelEncoder()
            y_encoded = label_encoder.fit_transform(y)
            classes = label_encoder.classes_.tolist()
            
            # Create and fit logistic regression model
            model = LogisticRegression(max_iter=1000)
            model.fit(X, y_encoded)
            
            # Get predictions and probabilities
            y_pred = model.predict(X)
            y_prob = model.predict_proba(X)[:, 1]  # Probability of the positive class
            
            # Calculate confusion matrix
            cm = confusion_matrix(y_encoded, y_pred).tolist()
            
            # Generate classification report
            report = classification_report(y_encoded, y_pred, output_dict=True)
            
            # Calculate AUC score if possible
            try:
                auc_score = float(roc_auc_score(y_encoded, y_prob))
                
                # Get ROC curve points for plotting
                fpr, tpr, _ = roc_curve(y_encoded, y_prob)
                roc_points = [{"fpr": float(f), "tpr": float(t)} for f, t in zip(fpr, tpr)]
            except:
                auc_score = None
                roc_points = None
            
            # Calculate VIF for multicollinearity warning
            vif_values = {}
            collinearity_warning = False
            
            if X.shape[1] > 1:
                try:
                    # Create a DataFrame for VIF calculation
                    X_df = pd.DataFrame(X, columns=column_names if len(column_names) == X.shape[1] 
                                      else [f"X{i+1}" for i in range(X.shape[1])])
                    
                    # Calculate VIF for each feature
                    for i, col in enumerate(X_df.columns):
                        try:
                            vif = variance_inflation_factor(X_df.values, i)
                            # Handle infinite VIF values
                            if np.isfinite(vif):
                                vif_values[col] = float(vif)
                            else:
                                vif_values[col] = 10.0  # Assign a high value for extreme collinearity
                                
                            if vif > 5:  # Common threshold for multicollinearity concern
                                collinearity_warning = True
                        except:
                            vif_values[col] = 1.0  # Default safe value if calculation fails
                except Exception as e:
                    print(f"Error calculating VIF: {e}")
            
            # Handle NaN and Inf values
            def safe_float(value):
                if value is None or np.isnan(value) or np.isinf(value):
                    return 0.0
                return float(value)
            
            # Create result object with logistic regression metrics
            result = {
                "regression_type": "logistic",
                "intercept": safe_float(model.intercept_[0]),
                "coefficients": [safe_float(c) for c in model.coef_[0]],
                "classes": classes,
                "accuracy": safe_float(report["accuracy"]),
                "confusion_matrix": cm,
                "classification_report": {
                    k: {kk: safe_float(vv) for kk, vv in v.items()} 
                    for k, v in report.items() if isinstance(v, dict)
                },
                "auc_score": safe_float(auc_score) if auc_score is not None else None,
                "roc_points": roc_points,
                "predicted_probabilities": [safe_float(p) for p in y_prob.tolist()],
                "predicted_classes": y_pred.tolist(),
                "vif_values": {k: safe_float(v) for k, v in vif_values.items()},
                "collinearity_warning": collinearity_warning
            }
            
            return result
                
        # For other regression types, keep existing implementation
        elif regression_type == "linear":
            model = LinearRegression()
            X_model = X
            
        elif regression_type == "polynomial":
            if X.shape[1] > 1:
                raise HTTPException(
                    status_code=400, 
                    detail="Polynomial regression currently supports only one independent variable"
                )
                
            poly = PolynomialFeatures(degree=polynomial_degree)
            X_model = poly.fit_transform(X)[:, 1:]  # Skip the intercept term
            model = LinearRegression()
            
        elif regression_type == "ridge":
            model = Ridge(alpha=1.0)
            X_model = X
            
        elif regression_type == "lasso":
            model = Lasso(alpha=0.1)
            X_model = X
            
        else:
            raise HTTPException(
                status_code=400, 
                detail=f"Unsupported regression type: {regression_type}"
            )
        
        # Fit the model
        model.fit(X_model, y)
        
        # Get predictions
        y_pred = model.predict(X_model)
        
        # Calculate residuals
        residuals = y - y_pred
        
        # Calculate statistics
        n = len(y)
        p = X_model.shape[1]  # Number of predictors (excluding intercept)
        
        # Calculate R-squared with safety checks
        ss_total = np.sum((y - np.mean(y)) ** 2)
        ss_residual = np.sum(residuals ** 2)
        
        # Handle division by zero for perfect fits
        if ss_total == 0:
            r_squared = 1.0
        else:
            r_squared = 1 - (ss_residual / ss_total)
        
        # Calculate adjusted R-squared (handle edge cases)
        if n - p - 1 <= 0:
            adjusted_r_squared = r_squared  # Not enough data for adjustment
        else:
            adjusted_r_squared = 1 - ((1 - r_squared) * (n - 1) / (n - p - 1))
        
        # Calculate standard error (handle division by zero)
        if n - p - 1 <= 0:
            std_error = 0.0
        else:
            std_error = np.sqrt(ss_residual / (n - p - 1))
        
        # Calculate F-statistic with safety checks
        if p == 0 or ss_residual == 0 or n - p - 1 <= 0:
            f_statistic = 0.0
        else:
            f_statistic = ((ss_total - ss_residual) / p) / (ss_residual / (n - p - 1))
        
        # Calculate p-value for F-statistic
        if p > 0 and n - p - 1 > 0:
            p_value = float(1 - stats.f.cdf(f_statistic, p, n - p - 1))
        else:
            p_value = 1.0
        
        # Calculate coefficient p-values
        # First, get the design matrix with an intercept
        if regression_type == "polynomial":
            # For polynomial, use the full polynomial features
            X_with_intercept = np.hstack((np.ones((X.shape[0], 1)), X_model))
        else:
            # For other models, just add an intercept column
            X_with_intercept = np.hstack((np.ones((X.shape[0], 1)), X))
            
        # Calculate variance-covariance matrix
        try:
            # Handle singular matrices and other numerical issues
            mse = np.sum(residuals**2) / max(1, (n - p - 1))
            
            # Use pseudo-inverse for more robust calculation
            cov_matrix = mse * np.linalg.pinv(np.dot(X_with_intercept.T, X_with_intercept))
            
            # Get standard errors for coefficients
            se = np.sqrt(np.diag(cov_matrix))
            
            # t-values for coefficients
            t_values = np.concatenate(([model.intercept_], model.coef_)) / np.maximum(se, 1e-10)
            
            # p-values for coefficients
            p_values = 2 * (1 - stats.t.cdf(np.abs(t_values), max(1, n - p - 1)))
            
            # Separate intercept p-value and coefficient p-values
            intercept_p_value = float(p_values[0])
            coefficient_p_values = p_values[1:].tolist()
        except Exception as e:
            print(f"Error calculating p-values: {e}")
            # In case of numerical issues, use safe defaults
            intercept_p_value = 0.05
            coefficient_p_values = [0.05] * len(model.coef_)
        
        # Calculate VIF for multicollinearity (only for multiple regression)
        vif_values = {}
        collinearity_warning = False
        
        if X.shape[1] > 1 and regression_type != "polynomial":
            try:
                # Create a DataFrame for VIF calculation
                X_df = pd.DataFrame(X, columns=column_names if len(column_names) == X.shape[1] 
                                   else [f"X{i+1}" for i in range(X.shape[1])])
                
                # Calculate VIF for each feature
                for i, col in enumerate(X_df.columns):
                    try:
                        vif = variance_inflation_factor(X_df.values, i)
                        # Handle infinite VIF values
                        if np.isfinite(vif):
                            vif_values[col] = float(vif)
                        else:
                            vif_values[col] = 10.0  # Assign a high value for extreme collinearity
                            
                        if vif > 5:  # Common threshold for multicollinearity concern
                            collinearity_warning = True
                    except:
                        vif_values[col] = 1.0  # Default safe value if calculation fails
            except Exception as e:
                print(f"Error calculating VIF: {e}")
                # If VIF calculation fails, set safe defaults
                for col in (column_names if len(column_names) == X.shape[1] 
                           else [f"X{i+1}" for i in range(X.shape[1])]):
                    vif_values[col] = 1.0
        
        # Handle NaN and Inf values that might cause JSON serialization issues
        def safe_float(value):
            if value is None or np.isnan(value) or np.isinf(value):
                return 0.0
            return float(value)
        
        # Prepare result
        if regression_type == "polynomial":
            # For polynomial, the coefficients are for powers of x
            coefs = model.coef_.tolist()
            
            # Create expanded column names for polynomial features
            if len(column_names) == 1:
                expanded_names = [f"{column_names[0]}^{i+1}" for i in range(polynomial_degree)]
                column_names = expanded_names
        else:
            coefs = model.coef_.tolist()
        
        # Convert all arrays to Python lists for JSON serialization
        result = {
            "intercept": safe_float(model.intercept_),
            "coefficients": [safe_float(c) for c in coefs],
            "r_squared": safe_float(r_squared),
            "adjusted_r_squared": safe_float(adjusted_r_squared),
            "standard_error": safe_float(std_error),
            "f_statistic": safe_float(f_statistic),
            "p_value": safe_float(p_value),
            "intercept_p_value": safe_float(intercept_p_value),
            "coefficient_p_values": [safe_float(p) for p in coefficient_p_values],
            "predicted_values": [safe_float(p) for p in y_pred.tolist()],
            "residuals": [safe_float(r) for r in residuals.tolist()],
            "vif_values": {k: safe_float(v) for k, v in vif_values.items()},
            "collinearity_warning": collinearity_warning
        }
        
        return result
        
    except Exception as e:
        print(f"Regression error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/predict")
async def predict_outcome(data: dict):
    try:
        # Get prediction inputs
        input_values = np.array(data.get("input_values", []))
        regression_type = data.get("regression_type", "linear")
        model_params = data.get("model_params", {})
        polynomial_degree = data.get("polynomial_degree", 2)
        column_names = data.get("column_names", [])
        
        if len(input_values) == 0 or not model_params:
            raise HTTPException(status_code=400, detail="Missing input values or model parameters")
        
        # Reshape input for single row
        if len(input_values.shape) == 1:
            X = input_values.reshape(1, -1)
        else:
            X = input_values
            
        # Get model parameters
        intercept = model_params.get("intercept", 0)
        coefficients = model_params.get("coefficients", [])
        
        if not coefficients:
            raise HTTPException(status_code=400, detail="Missing model coefficients")
        
        # Make prediction based on regression type
        if regression_type == "logistic":
            # For logistic regression
            classes = model_params.get("classes", [0, 1])
            
            # Calculate logits (log-odds)
            logits = intercept
            for i, value in enumerate(X[0]):
                if i < len(coefficients):
                    logits += coefficients[i] * value
            
            # Apply sigmoid function to get probability
            probability = 1 / (1 + np.exp(-logits))
            
            # Determine predicted class using 0.5 threshold
            predicted_class = int(probability >= 0.5)
            predicted_label = classes[predicted_class] if len(classes) > predicted_class else predicted_class
            
            # Create result with detailed explanation
            result = {
                "predicted_class": predicted_label,
                "probability": float(probability),
                "details": {
                    "log_odds": float(logits),
                    "equation_terms": [
                        {"term": "intercept", "value": float(intercept)}
                    ]
                }
            }
            
            # Add feature contributions
            for i, (value, coef) in enumerate(zip(X[0], coefficients)):
                term_name = column_names[i] if i < len(column_names) else f"X{i+1}"
                contribution = float(coef * value)
                result["details"]["equation_terms"].append({
                    "term": term_name,
                    "coefficient": float(coef),
                    "value": float(value),
                    "contribution": contribution
                })
                
            return result
            
        elif regression_type == "polynomial":
            # For polynomial regression
            if X.shape[1] > 1:
                raise HTTPException(
                    status_code=400, 
                    detail="Polynomial prediction supports only one independent variable"
                )
                
            # Transform input for polynomial features
            poly = PolynomialFeatures(degree=polynomial_degree)
            X_poly = poly.fit_transform(X)[:, 1:]  # Skip the intercept term
            
            # Calculate prediction
            y_pred = intercept
            for i, coef in enumerate(coefficients):
                if i < X_poly.shape[1]:
                    y_pred += coef * X_poly[0, i]
            
            # Create result with detailed explanation
            result = {
                "predicted_value": float(y_pred),
                "details": {
                    "equation_terms": [
                        {"term": "intercept", "value": float(intercept)}
                    ]
                }
            }
            
            # Add polynomial terms
            for i, coef in enumerate(coefficients):
                term_name = f"{column_names[0] if column_names else 'X'}^{i+1}"
                value = float(X[0, 0] ** (i+1))
                contribution = float(coef * value)
                result["details"]["equation_terms"].append({
                    "term": term_name,
                    "coefficient": float(coef),
                    "value": value,
                    "contribution": contribution
                })
                
            return result
            
        else:
            # For linear, ridge, lasso regression
            y_pred = intercept
            
            # Create result with detailed explanation
            result = {
                "details": {
                    "equation_terms": [
                        {"term": "intercept", "value": float(intercept)}
                    ]
                }
            }
            
            # Add feature contributions
            for i, (value, coef) in enumerate(zip(X[0], coefficients)):
                if i < len(coefficients):
                    y_pred += coef * value
                    term_name = column_names[i] if i < len(column_names) else f"X{i+1}"
                    contribution = float(coef * value)
                    result["details"]["equation_terms"].append({
                        "term": term_name,
                        "coefficient": float(coef),
                        "value": float(value),
                        "contribution": contribution
                    })
            
            result["predicted_value"] = float(y_pred)
            
            # Add confidence intervals if standard error is provided
            std_error = model_params.get("standard_error")
            if std_error:
                result["confidence_intervals"] = {
                    "95%": [float(y_pred - 1.96 * std_error), float(y_pred + 1.96 * std_error)],
                    "90%": [float(y_pred - 1.645 * std_error), float(y_pred + 1.645 * std_error)]
                }
                
            return result
        
        
            
    except Exception as e:
        print(f"Prediction error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# AI query endpoint
from fastapi.responses import JSONResponse
import traceback
import json
from scipy.stats import pearsonr
import numpy as np

@app.post("/api/ask")
async def ask_ai(request: Request):
    try:
        data = await request.json()
        query = data.get("query")
        spreadsheet_data = data.get("data")

        if not query or not spreadsheet_data:
            return JSONResponse(
                content={"error": "Missing query or spreadsheet data"},
                status_code=400,
                headers={"Access-Control-Allow-Origin": "*"}
            )

        headers = spreadsheet_data[0] if spreadsheet_data and len(spreadsheet_data) > 0 else []

        column_stats = {}
        for col_idx, header in enumerate(headers):
            try:
                values = [row[col_idx] for row in spreadsheet_data[1:] if col_idx < len(row) and row[col_idx] != '']
                if not values:
                    continue
                numeric_values = []
                for val in values:
                    try:
                        num_val = float(str(val).replace(',', ''))
                        numeric_values.append(num_val)
                    except (ValueError, TypeError):
                        pass

                stats = {
                    "count": len(values),
                    "unique": len(set(values)),
                    "missing": len(spreadsheet_data[1:]) - len(values)
                }

                if numeric_values:
                    stats.update({
                        "min": min(numeric_values),
                        "max": max(numeric_values),
                        "mean": sum(numeric_values) / len(numeric_values),
                        "median": sorted(numeric_values)[len(numeric_values)//2],
                        "std": np.std(numeric_values) if len(numeric_values) > 1 else 0
                    })

                column_stats[header] = stats

            except Exception as e:
                print(f"Error processing column {header}: {str(e)}")
                continue

        correlations = {}
        numeric_columns = {h: [] for h, s in column_stats.items() if "mean" in s}

        if len(numeric_columns) >= 2:
            for col_idx, header in enumerate(headers):
                if header in numeric_columns:
                    try:
                        values = [float(row[col_idx]) for row in spreadsheet_data[1:] 
                                 if col_idx < len(row) and row[col_idx] != '']
                        numeric_columns[header] = values
                    except:
                        continue

            for col1 in numeric_columns:
                correlations[col1] = {}
                for col2 in numeric_columns:
                    if col1 != col2:
                        try:
                            corr, _ = pearsonr(numeric_columns[col1], numeric_columns[col2])
                            correlations[col1][col2] = corr
                        except:
                            correlations[col1][col2] = None

        prompt = f"""
Here is a comprehensive analysis of a dataset with {len(spreadsheet_data)} rows and {len(headers)} columns.

Column Statistics:
{json.dumps(column_stats, indent=2)}

Correlations between numeric columns:
{json.dumps(correlations, indent=2)}

User's question: {query}

Please analyze the data using these comprehensive statistics to provide a detailed answer.
If the question requires specific data points, explain that you're using statistical summaries of the entire dataset.
If the answer involves identifying trends or patterns, use the correlation analysis and statistical summaries.
If you need more specific data to answer accurately, explain what additional information would be helpful.
"""

        response = openai.chat.completions.create(
            model="gpt-4",
            messages=[{"role": "user", "content": prompt}]
        )

        return JSONResponse(
            content={"answer": response.choices[0].message.content},
            headers={"Access-Control-Allow-Origin": "*"}
        )

    except Exception as e:
        traceback.print_exc()
        return JSONResponse(
            content={"error": str(e)},
            status_code=500,
            headers={"Access-Control-Allow-Origin": "*"}
        )


@app.post("/api/data-cleaning")
async def analyze_data_for_cleaning(request: Request):
    """
    Analyzes spreadsheet data and suggests cleaning operations using AI.
    """
    try:
        # Get raw request body
        body_bytes = await request.body()
        
        # Convert bytes to string and parse JSON manually
        body_str = body_bytes.decode('utf-8')
        
        if not body_str:
            return {"error": "Empty request body"}
        
        print(f"Received request body: {body_str[:100]}...")
        
        try:
            body = json.loads(body_str)
        except json.JSONDecodeError as e:
            print(f"JSON parsing error: {e}")
            return {"error": f"Invalid JSON: {str(e)}"}
        
        # Extract fields from parsed JSON
        data = body.get("data", [])
        retry_feedback = body.get("retry_feedback")
        
        # Validate data
        if not isinstance(data, list) or len(data) < 2:
            return {"error": "Insufficient data for analysis. Need at least headers and one data row."}
        
        headers = data[0]
        data_rows = data[1:]
        
        # Perform basic data analysis for each column
        basic_analysis = []
        
        for col_idx, header in enumerate(headers):
            # Extract column values
            column_values = [row[col_idx] if col_idx < len(row) else None for row in data_rows]
            
            # Calculate basic metrics
            total_values = len(column_values)
            missing_values = sum(1 for val in column_values if val is None or val == '')
            non_empty_values = [val for val in column_values if val is not None and val != '']
            
            if not non_empty_values:
                basic_analysis.append({
                    "index": col_idx,
                    "name": header or f"Column {col_idx + 1}",
                    "type": "unknown",
                    "confidence": 0,
                    "stats": {
                        "total": total_values,
                        "missing": missing_values,
                        "unique": 0
                    },
                    "issues": [
                        {
                            "type": "empty_column",
                            "description": "Column contains no data",
                            "severity": "high"
                        }
                    ]
                })
                continue
            
            # Count unique values
            unique_values = len(set(non_empty_values))
            
            # Attempt to detect column type
            numeric_values = []
            date_values = 0
            
            # Check for numeric values
            for val in non_empty_values:
                try:
                    num_val = float(str(val).replace(',', ''))
                    numeric_values.append(num_val)
                except (ValueError, TypeError):
                    pass
            
            # Check for date patterns
            date_pattern = re.compile(r'^\d{1,4}[-/\.]\d{1,2}[-/\.]\d{1,4}$')
            date_values = sum(1 for val in non_empty_values if date_pattern.match(str(val)))
            
            # Determine column type
            col_type = "text"
            type_confidence = 0.5
            
            if len(numeric_values) / len(non_empty_values) > 0.7:
                col_type = "numeric"
                type_confidence = len(numeric_values) / len(non_empty_values)
            elif date_values / len(non_empty_values) > 0.7:
                col_type = "date"
                type_confidence = date_values / len(non_empty_values)
            elif unique_values / len(non_empty_values) < 0.3:
                col_type = "categorical"
                type_confidence = 0.8
            
            # Collect stats for this column
            stats = {
                "total": total_values,
                "missing": missing_values,
                "unique": unique_values
            }
            
            # Add numeric stats if applicable
            if col_type == "numeric" and numeric_values:
                stats.update({
                    "min": min(numeric_values),
                    "max": max(numeric_values),
                    "mean": sum(numeric_values) / len(numeric_values),
                    "median": sorted(numeric_values)[len(numeric_values) // 2]
                })
            
            # Detect basic issues
            issues = []
            
            # Check for missing values
            if missing_values > 0:
                severity = "high" if missing_values > total_values * 0.2 else "medium"
                issues.append({
                    "type": "missing_values",
                    "count": missing_values,
                    "description": f"{missing_values} missing values detected",
                    "severity": severity
                })
            
            # Check for type mismatches in numeric columns
            if col_type == "numeric" and len(numeric_values) < len(non_empty_values):
                non_numeric_count = len(non_empty_values) - len(numeric_values)
                issues.append({
                    "type": "type_mismatch",
                    "count": non_numeric_count,
                    "description": f"{non_numeric_count} non-numeric values found",
                    "severity": "high"
                })
            
            basic_analysis.append({
                "index": col_idx,
                "name": header or f"Column {col_idx + 1}",
                "type": col_type,
                "confidence": type_confidence,
                "stats": stats,
                "issues": issues
            })
        
        # Skip AI enhancement if there's an issue with OpenAI API
        try_ai_enhancement = True
        
        if try_ai_enhancement:
            try:
                # Create prompt for AI enhancement
                sample_rows = min(10, len(data_rows))
                sample_data = data_rows[:sample_rows]
                
                ai_prompt = f"""
I'm analyzing a spreadsheet with the following columns:
{', '.join(headers)}

Here's a sample of the data (first {sample_rows} rows):
{json.dumps(sample_data)}

For each column, I've done some basic analysis:
{json.dumps(basic_analysis, indent=2)}

{retry_feedback if retry_feedback else ""}

Please provide for each column:
1. A more precise data type classification
2. Additional issues that might not be detected
3. Specific cleaning recommendations with explanation
4. The severity of each issue (low, medium, high)

Format your response as JSON with the following structure:
{{
  "columns": [
    {{
      "index": 0,
      "refinedType": "string",
      "additionalIssues": [
        {{
          "type": "issue_type",
          "description": "Issue description",
          "severity": "medium",
          "recommendation": "How to fix this issue"
        }}
      ]
    }}
  ]
}}
"""
                # Call OpenAI API with error handling
                try:
                    ai_response = openai.chat.completions.create(
                        model="gpt-4o",
                        messages=[{"role": "user", "content": ai_prompt}],
                        temperature=0.2,
                        max_tokens=2000
                    )
                    
                    ai_content = ai_response.choices[0].message.content
                    
                    # Log what we received
                    print(f"Received AI response (first 100 chars): {ai_content[:100]}...")
                    
                    # Try to parse the AI response
                    try:
                        ai_result = json.loads(ai_content)
                    except json.JSONDecodeError as json_error:
                        print(f"Failed to parse OpenAI response as JSON: {json_error}")
                        print(f"Raw response content: {ai_content[:200]}...")
                        
                        # Fall back to a simple analysis without AI enhancement
                        ai_result = {"columns": []}
                        
                except Exception as openai_error:
                    print(f"Error calling OpenAI API: {str(openai_error)}")
                    # Fall back to a simple analysis
                    ai_result = {"columns": []}
                
                # Merge AI recommendations with basic analysis (if any)
                for col in basic_analysis:
                    ai_col = next((c for c in ai_result.get("columns", []) if c.get("index") == col["index"]), None)
                    
                    if ai_col:
                        # Update the column type if AI provided a refined type
                        if "refinedType" in ai_col and ai_col["refinedType"]:
                            col["type"] = ai_col["refinedType"]
                        
                        # Add AI-detected issues
                        if "additionalIssues" in ai_col and ai_col["additionalIssues"]:
                            col["issues"].extend(ai_col["additionalIssues"])
            
            except Exception as ai_error:
                print(f"Error during AI enhancement: {str(ai_error)}")
                # Continue with basic analysis only
        
        # Generate cleaning suggestions
        suggestions = []
        for column in basic_analysis:
            if column["issues"]:
                for issue in column["issues"]:
                    # Generate action based on issue type
                    action = {}
                    
                    if issue["type"] == "missing_values":
                        if column["type"] == "numeric" and "mean" in column["stats"]:
                            action = {
                                "type": "fill_missing",
                                "value": column["stats"]["mean"],
                                "description": f"Fill missing values with mean ({column['stats']['mean']:.2f})"
                            }
                        elif column["type"] == "categorical":
                            # Find most common value (not implemented here, would require additional analysis)
                            action = {
                                "type": "fill_missing",
                                "value": "MOST_COMMON",  # Placeholder
                                "description": "Fill missing values with most common value"
                            }
                        else:
                            action = {
                                "type": "remove_rows",
                                "description": "Remove rows with missing values"
                            }
                    elif issue["type"] == "type_mismatch":
                        action = {
                            "type": "convert_type",
                            "description": f"Convert values to {column['type']} format or replace with null"
                        }
                    
                    # Add recommendation from AI if available
                    recommendation = issue.get("recommendation", "")
                    
                    if action:
                        suggestions.append({
                            "column_index": column["index"],
                            "column_name": column["name"],
                            "issue_type": issue["type"],
                            "action": action,
                            "recommendation": recommendation,
                            "severity": issue.get("severity", "medium")
                        })
        
        # Generate summary statistics
        columns_with_issues = sum(1 for col in basic_analysis if col["issues"])
        total_issues = sum(len(col["issues"]) for col in basic_analysis)
        critical_issues = sum(
            1 for col in basic_analysis 
            for issue in col["issues"] 
            if issue.get("severity") == "high"
        )
        
        summary = {
            "totalColumns": len(basic_analysis),
            "columnsWithIssues": columns_with_issues,
            "cleanColumns": len(basic_analysis) - columns_with_issues,
            "totalIssues": total_issues,
            "criticalIssues": critical_issues
        }
        
        return {
            "columns": basic_analysis,
            "suggestions": suggestions,
            "summary": summary
        }
        
    except Exception as e:
        print(f"Error in data cleaning analysis: {str(e)}")
        import traceback
        traceback.print_exc()
        return {"error": str(e)}

@app.post("/api/echo")
async def echo_data(request: Request):
    """Simple endpoint to echo back the received data for testing"""
    try:
        raw_body = await request.body()
        try:
            body_dict = json.loads(raw_body)
            return {"received": body_dict, "status": "success"}
        except json.JSONDecodeError as e:
            return {"error": f"Invalid JSON format: {str(e)}", "raw_data": raw_body.decode('utf-8', errors='ignore')}
    except Exception as e:
        return {"error": str(e)}

@app.post("/api/debug")
async def debug_request(request: Request):
    """Debug endpoint to inspect the request details"""
    try:
        # Get headers
        headers = dict(request.headers)
        
        # Get query params
        query_params = dict(request.query_params)
        
        # Try to get body
        try:
            body = await request.body()
            body_text = body.decode('utf-8', errors='ignore')
            
            # Try to parse as JSON
            try:
                body_json = json.loads(body_text)
            except:
                body_json = None
                
            return {
                "headers": headers,
                "query_params": query_params,
                "body_length": len(body),
                "body_sample": body_text[:200] + ("..." if len(body_text) > 200 else ""),
                "parsed_json": body_json is not None,
                "status": "success"
            }
        except Exception as body_error:
            return {
                "headers": headers,
                "query_params": query_params,
                "body_error": str(body_error),
                "status": "error reading body"
            }
    except Exception as e:
        return {"error": str(e)}

# First, let's create a helper function to handle request data
async def process_request_data(data: dict, endpoint_func) -> dict:
    """Helper function to process request data through an endpoint function"""
    try:
        # Create a mock request object with the data
        class MockReceive:
            async def __call__(self):
                return {
                    "type": "http.request",
                    "body": json.dumps(data).encode(),
                    "more_body": False
                }

        request = Request(
            scope={
                "type": "http",
                "method": "POST",
                "headers": []
            },
            receive=MockReceive()
        )
        
        # Call the endpoint function
        return await endpoint_func(request)
    except Exception as e:
        print(f"Error processing request: {str(e)}")
        return {"error": str(e)}

# Now update the analysis functions
async def analyze_data_quality(sheet: SheetSelection) -> ReportSection:
    """Analyze data quality for a sheet"""
    try:
        # Prepare the data for analysis
        request_data = {
            "data": sheet.data
        }
        
        # Use the helper function to process the request
        cleaning_analysis = await process_request_data(request_data, analyze_data_for_cleaning)
        
        if isinstance(cleaning_analysis, dict):
            if "error" in cleaning_analysis:
                return ReportSection(
                    title="Data Quality Analysis",
                    content=cleaning_analysis,
                    insights=[f"Data quality analysis error: {cleaning_analysis['error']}"]
                )
            
            summary = cleaning_analysis.get("summary", {})
            return ReportSection(
                title="Data Quality Analysis",
                content=cleaning_analysis,
                insights=[
                    f"Analyzed {len(sheet.data[0])} columns and {len(sheet.data)-1} rows",
                    f"Found {summary.get('totalIssues', 0)} data quality issues",
                    f"Identified {summary.get('criticalIssues', 0)} critical issues"
                ]
            )
    except Exception as e:
        print(f"Error in data quality analysis: {str(e)}")
        return ReportSection(
            title="Data Quality Analysis",
            content={"error": str(e)},
            insights=["Data quality analysis failed"]
        )

async def perform_ai_analysis(sheet: SheetSelection, config: Dict) -> ReportSection:
    """Perform AI analysis on sheet data"""
    try:
        insights = []
        
        # Generate different types of insights based on config
        if config.get("trends"):
            trend_data = {
                "query": "What are the main trends in this data?",
                "data": sheet.data
            }
            trend_response = await process_request_data(trend_data, ask_ai)
            if isinstance(trend_response, dict) and "answer" in trend_response:
                insights.append(trend_response["answer"])
        
        if config.get("insights"):
            insight_data = {
                "query": "What are the key insights from this data?",
                "data": sheet.data
            }
            insight_response = await process_request_data(insight_data, ask_ai)
            if isinstance(insight_response, dict) and "answer" in insight_response:
                insights.append(insight_response["answer"])
        
        if config.get("recommendations"):
            recommendations_data = {
                "query": "What recommendations can you make based on this data?",
                "data": sheet.data
            }
            recommendations_response = await process_request_data(recommendations_data, ask_ai)
            if isinstance(recommendations_response, dict) and "answer" in recommendations_response:
                insights.append(recommendations_response["answer"])
        
        return ReportSection(
            title="AI Insights",
            content={"insights_count": len(insights)},
            insights=insights if insights else ["No AI insights generated"]
        )
    except Exception as e:
        print(f"Error in AI analysis: {str(e)}")
        return ReportSection(
            title="AI Insights",
            content={"error": str(e)},
            insights=["AI analysis failed"]
        )

# Add this new function to generate summary metrics
def generate_summary_metrics(sheet: SheetSelection) -> Dict[str, Any]:
    try:
        metrics = {}
        
        # Get numeric columns (excluding first column if it's labels)
        numeric_cols = []
        for col_idx in range(1, len(sheet.data[0])):
            try:
                [float(row[col_idx]) for row in sheet.data[1:]]
                numeric_cols.append(col_idx)
            except (ValueError, TypeError):
                continue
        
        # Calculate key metrics for each numeric column
        for col_idx in numeric_cols:
            col_name = sheet.data[0][col_idx]
            values = [float(row[col_idx]) for row in sheet.data[1:]]
            
            metrics[col_name] = {
                "total": sum(values),
                "average": sum(values) / len(values),
                "min": min(values),
                "max": max(values),
                "growth": (values[-1] - values[0]) / values[0] * 100  # Percentage growth
            }
        
        # If we have Sales and Expenses, calculate profit metrics
        if "Sales" in metrics and "Expenses" in metrics:
            sales = [float(row[1]) for row in sheet.data[1:]]
            expenses = [float(row[2]) for row in sheet.data[1:]]
            profits = [s - e for s, e in zip(sales, expenses)]
            
            metrics["Profit"] = {
                "total": sum(profits),
                "average": sum(profits) / len(profits),
                "min": min(profits),
                "max": max(profits),
                "growth": (profits[-1] - profits[0]) / profits[0] * 100
            }
        
        return metrics
    except Exception as e:
        print(f"Error generating summary metrics: {str(e)}")
        return {}

# Update the main report generation endpoint
@app.post("/api/reports/generate")
async def generate_report(request: ReportRequest):
    try:
        report_sections = []
        all_insights = []
        summary_metrics = {}
        
        # Process each selected sheet
        for sheet in request.selected_sheets:
            # Generate summary metrics
            sheet_metrics = generate_summary_metrics(sheet)
            summary_metrics[sheet.sheet_name] = sheet_metrics
            
            # 1. Data Quality Analysis
            if request.config.data_quality:
                quality_section = await analyze_data_quality(sheet)
                report_sections.append(quality_section)
            
            # 2. Statistical Analysis
            if request.config.statistical_analysis:
                stats_section = await perform_statistical_analysis(sheet, request.config.statistical_analysis)
                report_sections.append(stats_section)
            
            # 3. Predictive Analysis
            if request.config.predictive_analysis.get("regression") or request.config.predictive_analysis.get("forecast"):
                predictive_section = await perform_predictive_analysis(sheet, request.config.predictive_analysis)
                report_sections.append(predictive_section)
            
            # 4. Generate Visualizations
            if request.config.visualizations:
                viz_section = await generate_visualizations(sheet, request.config.visualizations)
                report_sections.append(viz_section)
            
            # 5. AI Analysis
            if request.config.ai_analysis:
                ai_section = await perform_ai_analysis(sheet, request.config.ai_analysis)
                report_sections.append(ai_section)
                all_insights.extend(ai_section.insights or [])

        # Create an executive summary section
        executive_summary = create_executive_summary(summary_metrics, all_insights)
        report_sections.insert(0, executive_summary)  # Add at the beginning
        
        # Create the final report with enhanced summary
        report = ReportResponse(
            report_id=f"report_{datetime.now().strftime('%Y%m%d_%H%M%S')}",
            title=request.title,
            description=request.description,
            created_at=datetime.now(),
            sections=report_sections,
            summary={
                "metrics": summary_metrics,
                "key_findings": all_insights[:3],
                "section_count": len(report_sections),
                "generated_at": datetime.now().isoformat(),
                "status": "completed"
            }
        )
        
        return report
        
    except Exception as e:
        print(f"Error generating report: {str(e)}")
        return ReportResponse(
            report_id="error",
            title=request.title,
            description=request.description,
            created_at=datetime.now(),
            sections=[],
            summary={},
            status="error",
            error=str(e)
        )

def create_executive_summary(metrics: Dict[str, Dict], insights: List[str]) -> ReportSection:
    """Create an executive summary section"""
    try:
        summary_points = []
        
        for sheet_name, sheet_metrics in metrics.items():
            if "Profit" in sheet_metrics:
                profit_metrics = sheet_metrics["Profit"]
                summary_points.extend([
                    f"Total Profit: ${profit_metrics['total']:,.2f}",
                    f"Average Monthly Profit: ${profit_metrics['average']:,.2f}",
                    f"Profit Growth: {profit_metrics['growth']:.1f}%"
                ])
        
        return ReportSection(
            title="Executive Summary",
            content={
                "metrics": metrics,
                "highlights": summary_points
            },
            insights=insights[:3] if insights else ["No key insights available"]
        )
    except Exception as e:
        print(f"Error creating executive summary: {str(e)}")
        return ReportSection(
            title="Executive Summary",
            content={"error": str(e)},
            insights=["Failed to generate executive summary"]
        )

# Add this function to main.py
async def perform_statistical_analysis(sheet: SheetSelection, config: Dict) -> ReportSection:
    """Perform statistical analysis on sheet data"""
    try:
        results = {}
        insights = []
        visualizations = []
        progress_updates = []

        # Get headers and data
        headers = sheet.data[0]
        data_rows = sheet.data[1:]  # Use all data rows, not just a sample

        # Add initial progress update
        progress_updates.append({
            "stage": "initializing",
            "progress": 0,
            "message": "Starting statistical analysis..."
        })

        # Basic statistics
        if config.get("basic_stats", True):
            progress_updates.append({
                "stage": "processing",
                "progress": 20,
                "message": "Calculating basic statistics..."
            })

            stats = {}
            for col_idx, header in enumerate(headers):
                try:
                    # Update progress for each column
                    progress = 20 + int((col_idx / len(headers)) * 30)
                    progress_updates.append({
                        "stage": "processing",
                        "progress": progress,
                        "message": f"Analyzing column: {header}"
                    })

                    # Convert column values to float where possible
                    values = [float(row[col_idx]) for row in data_rows if row[col_idx] != '']
                    if values:
                        stats[header] = {
                            "count": len(values),
                            "sum": sum(values),
                            "mean": sum(values) / len(values),
                            "min": min(values),
                            "max": max(values),
                            "std": np.std(values) if len(values) > 1 else 0,
                            "median": np.median(values)
                        }
                        
                        # Add insight for significant changes
                        if len(values) > 1:
                            change = ((values[-1] - values[0]) / values[0]) * 100
                            insights.append(f"{header}: {change:+.1f}% change from start to end")
                except (ValueError, TypeError):
                    continue

            results["basic_stats"] = stats

        # Correlation analysis if we have numeric columns
        if config.get("correlation", False):
            progress_updates.append({
                "stage": "processing",
                "progress": 50,
                "message": "Performing correlation analysis..."
            })

            try:
                numeric_cols = {}
                for col_idx, header in enumerate(headers):
                    try:
                        values = [float(row[col_idx]) for row in data_rows if row[col_idx] != '']
                        if values:
                            numeric_cols[header] = values
                    except (ValueError, TypeError):
                        continue

                if len(numeric_cols) >= 2:
                    correlation_data = {
                        "data": [[value for value in numeric_cols[col]] for col in numeric_cols],
                        "columns": list(numeric_cols.keys())
                    }
                    
                    progress_updates.append({
                        "stage": "processing",
                        "progress": 60,
                        "message": "Calculating correlation matrix..."
                    })

                    correlation_result = await process_request_data(
                        correlation_data,
                        perform_correlation_analysis
                    )
                    
                    if correlation_result and "error" not in correlation_result:
                        results["correlation"] = correlation_result
                        
                        # Add correlation visualization
                        visualizations.append({
                            "type": "heatmap",
                            "data": correlation_result.get("matrix", []),
                            "config": {
                                "labels": list(numeric_cols.keys())
                            },
                            "title": "Correlation Matrix"
                        })

            except Exception as corr_error:
                print(f"Correlation analysis error: {str(corr_error)}")

        # Generate visualizations
        progress_updates.append({
            "stage": "processing",
            "progress": 70,
            "message": "Generating visualizations..."
        })

        for col_idx, header in enumerate(headers[1:], 1):  # Skip first column (usually labels)
            try:
                values = [float(row[col_idx]) for row in data_rows if row[col_idx] != '']
                
                # Line chart for trends
                visualizations.append({
                    "type": "line",
                    "data": {
                        "labels": [row[0] for row in data_rows],  # Use first column as labels
                        "datasets": [{
                            "label": header,
                            "data": values,
                            "borderColor": "rgba(75, 192, 192, 1)",
                            "tension": 0.1
                        }]
                    },
                    "title": f"{header} Trend"
                })
                
            except (ValueError, TypeError):
                continue

        # Profit analysis if applicable
        if "Sales" in stats and "Expenses" in stats:
            progress_updates.append({
                "stage": "processing",
                "progress": 80,
                "message": "Analyzing profit metrics..."
            })

            try:
                sales = [float(row[headers.index("Sales")]) for row in data_rows if row[headers.index("Sales")] != '']
                expenses = [float(row[headers.index("Expenses")]) for row in data_rows if row[headers.index("Expenses")] != '']
                profits = [s - e for s, e in zip(sales, expenses)]
                
                results["profit_analysis"] = {
                    "total_profit": sum(profits),
                    "average_profit": sum(profits) / len(profits),
                    "profit_margin": (sum(profits) / sum(sales)) * 100
                }
                
                # Add profit visualization
                visualizations.append({
                    "type": "bar",
                    "data": {
                        "labels": [row[0] for row in data_rows],
                        "datasets": [
                            {
                                "label": "Profit",
                                "data": profits,
                                "backgroundColor": "rgba(75, 192, 192, 0.5)"
                            }
                        ]
                    },
                    "title": "Profit Analysis"
                })
                
                insights.append(
                    f"Average profit margin: {results['profit_analysis']['profit_margin']:.1f}%"
                )
                
            except Exception as profit_error:
                print(f"Profit analysis error: {str(profit_error)}")

        # Format insights into a more readable structure
        progress_updates.append({
            "stage": "finalizing",
            "progress": 90,
            "message": "Formatting insights..."
        })

        formatted_insights = []
        for insight in insights:
            if "change from start to end" in insight:
                metric, change = insight.split(": ")
                change_value = float(change.split("%")[0])
                if change_value > 0:
                    formatted_insights.append(f"📈 {metric} increased by {abs(change_value):.1f}%")
                else:
                    formatted_insights.append(f"📉 {metric} decreased by {abs(change_value):.1f}%")
            else:
                formatted_insights.append(f"ℹ️ {insight}")

        # Add final progress update
        progress_updates.append({
            "stage": "completed",
            "progress": 100,
            "message": "Analysis complete!"
        })

        return ReportSection(
            title="Statistical Analysis",
            content=results,
            visualizations=visualizations,
            insights=formatted_insights,
            progress_updates=progress_updates
        )
        
    except Exception as e:
        print(f"Error in statistical analysis: {str(e)}")
        return ReportSection(
            title="Statistical Analysis",
            content={"error": str(e)},
            insights=["Statistical analysis failed"],
            progress_updates=[{
                "stage": "error",
                "progress": 0,
                "message": f"Error: {str(e)}"
            }]
        )

async def generate_visualizations(sheet: SheetSelection, viz_config: List[Dict]) -> ReportSection:
    """Generate visualizations based on configuration for any dataset"""
    try:
        visualizations = []
        insights = []

        # Get headers and data
        headers = sheet.data[0]
        data_rows = sheet.data[1:]

        # Identify numeric columns
        numeric_columns = []
        for col_idx, header in enumerate(headers):
            try:
                # Check if at least 70% of values in the column are numeric
                numeric_count = sum(1 for row in data_rows if isinstance(row[col_idx], (int, float)) 
                                 or (isinstance(row[col_idx], str) and row[col_idx].replace('.','',1).isdigit()))
                if numeric_count / len(data_rows) >= 0.7:
                    numeric_columns.append((col_idx, header))
            except:
                continue

        # Get categorical columns (non-numeric)
        categorical_columns = [(i, h) for i, h in enumerate(headers) if (i, h) not in numeric_columns]

        for viz in viz_config:
            viz_type = viz.get("type", "bar")
            viz_title = viz.get("title", "")

            try:
                if viz_type == "bar":
                    # If we have at least one numeric column and one categorical column
                    if numeric_columns and categorical_columns:
                        cat_idx, cat_header = categorical_columns[0]  # Use first categorical column for labels
                        labels = [str(row[cat_idx]) for row in data_rows]
                        
                        # Create datasets for up to 3 numeric columns
                        datasets = []
                        colors = ["rgba(54, 162, 235, 0.5)", "rgba(255, 99, 132, 0.5)", 
                                "rgba(75, 192, 192, 0.5)"]
                        
                        for (num_idx, num_header), color in zip(numeric_columns[:3], colors):
                            values = [float(row[num_idx]) if row[num_idx] not in ['', None] else 0 
                                    for row in data_rows]
                            datasets.append({
                                "label": num_header,
                                "data": values,
                                "backgroundColor": color
                            })

                        if datasets:  # Only create visualization if we have data
                            visualizations.append({
                                "type": "bar",
                                "data": {
                                    "labels": labels,
                                    "datasets": datasets
                                },
                                "title": viz_title or f"Comparison by {cat_header}"
                            })

                            # Add insight about highest values
                            for dataset in datasets:
                                max_val = max(dataset["data"])
                                max_idx = dataset["data"].index(max_val)
                                insights.append(
                                    f"Highest {dataset['label']}: {max_val:,.2f} in {labels[max_idx]}"
                                )

                elif viz_type == "line":
                    # Create line chart for numeric columns over time/sequence
                    if numeric_columns and categorical_columns:
                        cat_idx, cat_header = categorical_columns[0]
                        labels = [str(row[cat_idx]) for row in data_rows]
                        
                        datasets = []
                        colors = ["rgba(54, 162, 235, 1)", "rgba(255, 99, 132, 1)", 
                                "rgba(75, 192, 192, 1)"]
                        
                        for (num_idx, num_header), color in zip(numeric_columns[:3], colors):
                            values = [float(row[num_idx]) if row[num_idx] not in ['', None] else 0 
                                    for row in data_rows]
                            datasets.append({
                                "label": num_header,
                                "data": values,
                                "borderColor": color,
                                "tension": 0.1
                            })

                        if datasets:
                            visualizations.append({
                                "type": "line",
                                "data": {
                                    "labels": labels,
                                    "datasets": datasets
                                },
                                "title": viz_title or f"Trends over {cat_header}"
                            })

                            # Add trend insights
                            for dataset in datasets:
                                values = dataset["data"]
                                if len(values) > 1:
                                    change = ((values[-1] - values[0]) / values[0]) * 100
                                    insights.append(
                                        f"{dataset['label']} trend shows {change:+.1f}% change"
                                    )

                elif viz_type == "pie":
                    # Create pie chart for distribution of a single numeric column
                    if numeric_columns and categorical_columns:
                        cat_idx, cat_header = categorical_columns[0]
                        num_idx, num_header = numeric_columns[0]
                        
                        labels = [str(row[cat_idx]) for row in data_rows]
                        values = [float(row[num_idx]) if row[num_idx] not in ['', None] else 0 
                                for row in data_rows]

                        visualizations.append({
                            "type": "pie",
                            "data": {
                                "labels": labels,
                                "datasets": [{
                                    "data": values,
                                    "backgroundColor": [
                                        "rgba(54, 162, 235, 0.5)",
                                        "rgba(255, 99, 132, 0.5)",
                                        "rgba(75, 192, 192, 0.5)",
                                        "rgba(255, 206, 86, 0.5)"
                                    ]
                                }]
                            },
                            "title": viz_title or f"{num_header} Distribution"
                        })

                elif viz_type == "scatter":
                    # Create scatter plot if we have at least 2 numeric columns
                    if len(numeric_columns) >= 2:
                        x_idx, x_header = numeric_columns[0]
                        y_idx, y_header = numeric_columns[1]
                        
                        x_data = [float(row[x_idx]) if row[x_idx] not in ['', None] else 0 
                                for row in data_rows]
                        y_data = [float(row[y_idx]) if row[y_idx] not in ['', None] else 0 
                                for row in data_rows]

                        visualizations.append({
                            "type": "scatter",
                            "data": {
                                "datasets": [{
                                    "label": f"{x_header} vs {y_header}",
                                    "data": [{"x": x, "y": y} for x, y in zip(x_data, y_data)]
                                }]
                            },
                            "title": viz_title or f"{x_header} vs {y_header} Correlation"
                        })

            except Exception as viz_error:
                print(f"Error generating visualization {viz_type}: {str(viz_error)}")
                continue

        return ReportSection(
            title="Visualizations",
            content={},
            visualizations=visualizations,
            insights=insights
        )

    except Exception as e:
        print(f"Error in visualization generation: {str(e)}")
        return ReportSection(
            title="Visualizations",
            content={"error": str(e)},
            insights=["Visualization generation failed"]
        )

# Run with: uvicorn main:app --reload
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8080, reload=True)
