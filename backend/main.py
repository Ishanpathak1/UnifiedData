from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
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
    allow_origins=["*"],  # Allow all origins for testing
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
@app.post("/api/ask")
async def ask_ai(request: Request):
    data = await request.json()
    query = data.get("query")
    spreadsheet_data = data.get("data")
    
    if not query or not spreadsheet_data:
        return {"error": "Missing query or spreadsheet data"}

    # Extract headers (first row)
    headers = spreadsheet_data[0] if spreadsheet_data and len(spreadsheet_data) > 0 else []
    
    # Check if data is large (more than 300 rows)
    is_large_data = len(spreadsheet_data) > 200
    
    # Format spreadsheet data for the prompt
    if is_large_data:
        # Take first 50 rows for context (including headers)
        first_rows = spreadsheet_data[:51]  # This includes the header row
        
        # Take last 50 rows for context
        last_rows = spreadsheet_data[-50:] if len(spreadsheet_data) > 100 else []
        
        # Calculate basic statistics for numeric columns
        stats = {}
        for col_idx, header in enumerate(headers):
            # Try to extract numeric values from this column
            try:
                numeric_values = [float(row[col_idx]) for row in spreadsheet_data[1:] 
                                 if col_idx < len(row) and row[col_idx] != '' and 
                                 str(row[col_idx]).replace('.', '', 1).replace('-', '', 1).isdigit()]
                
                if numeric_values:
                    stats[header] = {
                        "min": min(numeric_values),
                        "max": max(numeric_values),
                        "mean": sum(numeric_values) / len(numeric_values),
                        "count": len(numeric_values)
                    }
            except:
                continue
        
        # Format first rows
        formatted_first_rows = "\n".join(["\t".join(map(str, row)) for row in first_rows])
        
        # Format last rows if we have them
        formatted_last_rows = ""
        if last_rows:
            formatted_last_rows = "\n".join(["\t".join(map(str, row)) for row in last_rows])
        
        # Format stats
        formatted_stats = "\n".join([f"{header}: min={stats[header]['min']:.2f}, max={stats[header]['max']:.2f}, mean={stats[header]['mean']:.2f}, count={stats[header]['count']}" 
                                    for header in stats])
        
        prompt = f"""
Here is a large spreadsheet (total {len(spreadsheet_data)} rows) with a sample of the data (tab-separated).
The column headers are: {', '.join(str(h) for h in headers)}

First 50 rows (including headers):
{formatted_first_rows}

{"Last 50 rows:" if formatted_last_rows else ""}
{formatted_last_rows if formatted_last_rows else ""}

Summary statistics for numeric columns:
{formatted_stats}

User's question: {query}

Analyze the spreadsheet data sample and statistics to give a clear, helpful answer. 
Be explicit that you're working with a sample of a larger dataset ({len(spreadsheet_data)} rows).
If the question requires calculations, show your work and note that you're using the provided statistics or sample.
If the answer involves identifying trends or patterns, explain them but note the limitations of working with a sample.
If you need the complete dataset to answer accurately, say so.
"""
    else:
        # For smaller datasets, use the original approach but highlight the headers
        formatted_data = "\n".join(["\t".join(map(str, row)) for row in spreadsheet_data])

        prompt = f"""
Here is a spreadsheet table (tab-separated):
The column headers are: {', '.join(str(h) for h in headers)}

{formatted_data}

User's question: {query}

Analyze the spreadsheet data and give a clear, helpful answer based on the data. 
If the question requires calculations, show your work.
If the answer involves identifying trends or patterns, explain them.
If the data is incomplete or doesn't contain information to answer the question, say so.
"""

    try:
        response = openai.chat.completions.create(
            model="gpt-4o",
            messages=[{"role": "user", "content": prompt}]
        )
        return {"answer": response.choices[0].message.content}
    except Exception as e:
        return {"error": str(e)}


# Run with: uvicorn main:app --reload
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8080, reload=True)
