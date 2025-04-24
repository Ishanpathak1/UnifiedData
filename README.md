# UnifiedData - Advanced Data Analysis Spreadsheet Application



## Overview

UnifiedData is a modern web-based spreadsheet application with advanced data analysis capabilities. It combines the familiarity of spreadsheet interfaces with powerful analytics, visualizations, and interactive dashboards, all within a collaborative environment.

## Features

### Core Spreadsheet Functionality
- **Intuitive Spreadsheet Interface**: Excel-like grid with cell editing, formulas, and formatting
- **Data Import/Export**: Support for CSV and Excel files with dependency tracking
- **Real-time Collaboration**: Multiple users can work on the same document simultaneously
- **Auto-saving**: Automatic saving of changes to prevent data loss
- **File History**: Track revisions and revert to previous versions when needed

### Advanced Data Analysis

#### Regression Analysis
- **Multiple Regression Types**: Linear, logistic, polynomial, ridge, and lasso regression
- **Statistical Metrics**: R-squared, adjusted R-squared, p-values, F-statistic, and standard errors
- **Residual Analysis**: Plots of residuals to validate model assumptions
- **Collinearity Diagnostics**: VIF (Variance Inflation Factor) detection
- **Classification Metrics**: For logistic regression, including accuracy, precision, recall, F1 score
- **ROC Curve Analysis**: AUC scores and visual ROC curve for classification performance
- **Model Comparison**: Compare multiple regression models side-by-side

#### Correlation Analysis
- **Multiple Correlation Methods**: Pearson, Spearman, and Kendall tau correlation coefficients
- **Statistical Significance**: p-values for all correlation coefficients
- **Heatmap Visualization**: Color-coded correlation matrices
- **Interpretations**: Automatic interpretation of correlation strength and significance
- **Scatter Plot Matrix**: Visualize relationships between multiple variables simultaneously

#### Principal Component Analysis (PCA)
- **Dimensionality Reduction**: Reduce high-dimensional data to principal components
- **Explained Variance**: Track variance explained by each component
- **Component Visualization**: Plot data on principal component axes
- **Loading Vectors**: Analyze feature contributions to principal components
- **Standardization**: Automatic data standardization for accurate analysis

#### Matrix Operations
- **Basic Operations**: Addition, subtraction, multiplication, and transpose
- **Advanced Operations**: Inverse, determinant, eigenvalue decomposition
- **Singular Value Decomposition (SVD)**: Decompose matrices for analysis
- **Visualizations**: Visual representation of matrix operations and transformations
- **Error Handling**: Robust handling of singular matrices and dimension mismatches

#### Time Series Forecasting
- **Multiple Methods**: ARIMA models and exponential smoothing
- **Automatic Parameter Selection**: Smart model selection based on data patterns
- **Seasonality Detection**: Automatic detection of seasonal patterns
- **Confidence Intervals**: Visual representation of forecast uncertainty
- **Error Metrics**: MAE and MAPE metrics to evaluate forecast accuracy

### Visualization Tools
- **Interactive Charts**: Create bar, line, pie, doughnut, polar area, and radar charts
- **Chart Customization**: Fully customize colors, labels, and display options
- **Scatter Plots**: Visualize relationships between variables
- **ROC Curves**: Evaluate classification model performance
- **Time Series Plots**: Visualize time-based data with trend lines
- **Box Plots**: Analyze data distributions and identify outliers
- **Heatmaps**: Visualize matrices and correlation data
- **Export Options**: Download charts as images for presentations and reports

### Dashboard Functionality
- **Interactive Dashboards**: Create custom dashboards with multiple visualizations
- **Live Data Connection**: Dashboards update automatically when source data changes


### AI Integration
- **Data Analysis Assistant**: Ask questions about your data in natural language
- **Chart Recommendations**: AI suggests appropriate chart types based on your data
- **Data Cleaning Suggestions**: Get recommendations for handling missing values and outliers
- **Natural Language Queries**: Generate insights without writing complex formulas
- **Insight Generation**: Automatic identification of patterns and anomalies in your data

### Data Management
- **Data Cleaning Tools**: Remove outliers, fill missing values, normalize data
- **Data Type Detection**: Automatic identification of text, numerical, and date values
- **Data Inspector**: Explore and understand your dataset with descriptive statistics
- **Import Warnings**: Alert when imported data might affect existing dashboards
- **Template Library**: Pre-built templates for common analysis scenarios
- **Version History**: Track changes and revert to previous versions if needed

## Technology Stack

### Frontend
- **Framework**: React.js with Next.js for server-side rendering
- **UI Components**: Custom React components
- **Data Visualization**: Chart.js with custom wrappers
- **Spreadsheet Engine**: Handsontable for Excel-like experience
- **Grid Layout**: React Grid Layout for dashboard customization
- **State Management**: React Context API and custom hooks
- **Authentication**: Firebase Authentication with Google Sign-In
- **Styling**: CSS Modules and custom theming system

### Backend
- **API Framework**: FastAPI for high-performance Python backend
- **Database**: Firebase Firestore for real-time data storage
- **Authentication**: Firebase Auth for user management
- **Storage**: Firebase Storage for file management
- **Functions**: Serverless functions for heavy computational tasks
- **Data Analysis**: 
  - NumPy and Pandas for data manipulation
  - scikit-learn for machine learning algorithms
  - statsmodels for statistical modeling
  - SciPy for scientific computing

### Data Analysis Libraries
- **Statistical Computing**: R integration for specialized analyses
- **Machine Learning**: TensorFlow.js and scikit-learn
- **Mathematical Operations**: math.js for client-side calculations
- **Natural Language Processing**: For AI assistant functionality

## Getting Started

### Prerequisites
- Node.js (v14.0.0 or later)
- npm (v6.0.0 or later)
- Python 3.8+ (for backend services)
- Firebase account (for backend services)

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/UnifiedData.git
   cd UnifiedData
   ```

2. Install frontend dependencies:
   ```bash
   npm install
   ```

3. Install backend dependencies:
   ```bash
   cd pages/api
   pip install -r requirements.txt
   cd ../..
   ```

4. Set up environment variables:
   Create a `.env.local` file in the root directory with your Firebase configuration:
   ```
   NEXT_PUBLIC_FIREBASE_API_KEY=your-api-key
   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-auth-domain
   NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
   NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-storage-bucket
   NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your-messaging-sender-id
   NEXT_PUBLIC_FIREBASE_APP_ID=your-app-id
   ```

5. Run the development server:
   ```bash
   npm run dev
   ```

6. Open [http://localhost:3000](http://localhost:3000) with your browser to see the application.

## Usage Instructions

### Creating a New Spreadsheet
1. Click "New Spreadsheet" on the home page
2. Use the grid interface to enter data
3. Changes are automatically saved to your account

### Importing Data
1. Click "File" > "Import File"
2. Select a CSV or Excel file from your computer
3. If the file would affect existing dashboards, you'll be prompted to create a new spreadsheet or replace the existing data

### Creating Charts
1. Select data in the spreadsheet
2. Click on the chart type you want to create in the toolbar
3. Customize the chart appearance as needed
4. Use "Add to Dashboard" to include the chart in a dashboard

### Running Analysis
1. Select the data you want to analyze
2. Choose the analysis type from the Analysis menu:
   - Regression Analysis (Linear, Logistic, etc.)
   - Correlation Analysis
   - PCA Analysis
   - Matrix Operations
   - Time Series Forecasting
3. Configure the analysis parameters
4. View results, including visualizations and statistical metrics
5. Optionally add the analysis results to a dashboard

### Creating Dashboards
1. Navigate to the Dashboards section
2. Click "New Dashboard"
3. Add charts and widgets from your spreadsheets
4. Arrange and resize elements using the drag-and-drop interface
5. Charts will automatically update when the source data changes

### Using AI Features
1. Click the "Ask AI" button in the top-right corner
2. Type your question about the data (e.g., "What's the correlation between sales and marketing spend?")
3. Review the AI-generated insights and visualizations


## Acknowledgments

- Handsontable for the spreadsheet component
- Chart.js for visualization capabilities
- Firebase for backend services
- FastAPI for the Python backend
- scikit-learn and statsmodels for statistical analysis
- The open-source community for various libraries and tools that made this project possible

---

## Contact

For questions or support, please contact us at ishan.pathak2711@gmail.com or open an issue on GitHub.
