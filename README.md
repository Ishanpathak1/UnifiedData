# UnifiedData - Advanced Data Analysis Spreadsheet Application

## Overview

UnifiedData is a modern web-based spreadsheet application with advanced data analysis capabilities. It combines the familiarity of spreadsheet interfaces with powerful analytics, matrix operations, and AI-powered insights, all within a collaborative environment.

## Demo

Try the live demo: [https://unifieddata.app](https://unifieddata.app)

## Features

### Core Spreadsheet Functionality
- **Intuitive Spreadsheet Interface**: Excel-like grid with cell editing and formatting
- **Data Import/Export**: Support for CSV and Excel files
- **Real-time Collaboration**: Multiple users can work on the same document simultaneously
- **Auto-saving**: Automatic saving of changes to prevent data loss

### Dashboard
- **Overview Dashboard**: Quick access to all your spreadsheets and recent activities
- **Activity Tracking**: View last modified dates and recent changes
- **Quick Actions**: Create new spreadsheets, import data, or access recent files
- **User Statistics**: Track your usage and data analysis activities

### Reports
- **AI-Powered Report Generation**: Automatically generate comprehensive reports from your spreadsheet data using advanced AI algorithms.
- **Report Types**:
  - Executive summaries
  - Key findings and insights
  - Data quality analysis
  - Statistical and predictive analysis
  - Visualizations and charts
- **Customizable Configuration**: Select which sheets and data to include, choose analysis types, and configure visualizations.
- **Natural Language Insights**: Receive plain-English explanations and recommendations based on your data.
- **Download & Share**: Export reports as PDF or share them with your team.
- **Easy Access**: All generated reports are saved and accessible from the Reports page for future reference.

### AI-Powered Features
- **Ask AI**: 
  - Natural language queries about your data
  - AI-generated insights and explanations
  - Context-aware responses based on your spreadsheet data
  - Support for complex analytical questions

- **Data Cleaning with AI**:
  - Automatic data quality assessment
  - Smart suggestions for data cleaning
  - Detection of anomalies and inconsistencies
  - Recommendations for data standardization
  - Missing value analysis and suggestions
  - Type detection and conversion recommendations

### Data Inspector
- **Column Analysis**:
  - Data type detection
  - Value distribution visualization
  - Missing value identification
  - Unique value counts
  - Basic statistics (mean, median, mode)
- **Quality Metrics**:
  - Data completeness score
  - Consistency checks
  - Format validation
  - Outlier detection
- **Interactive Previews**:
  - Quick value filtering
  - Sort and view options
  - Sample data examination

### Advanced Data Analysis

#### Matrix Operations
- **Basic Operations**: 
  - Addition: Add two matrices of the same dimensions
  - Subtraction: Subtract matrices of the same dimensions
  - Multiplication: Matrix multiplication with compatible dimensions
  - Transpose: Transpose a matrix
- **Advanced Operations**: 
  - Inverse: Calculate inverse of square matrices
  - Determinant: Calculate determinant of square matrices
  - Eigenvalues: Find eigenvalues of square matrices
- **Error Handling**: Robust handling of singular matrices and dimension mismatches
- **Visualizations**: Visual representation of matrix operations

## Usage Instructions

### Dashboard Navigation
1. View all your spreadsheets in the dashboard
2. Use quick actions to create or import spreadsheets
3. Access recent files and track modifications

### Creating a New Spreadsheet
1. Click "New Spreadsheet" on the dashboard
2. Use the grid interface to enter data
3. Changes are automatically saved to your account

### Generating Reports
1. Go to the **Reports** page from the main navigation.
2. Click "Create Report" and select the spreadsheet and sheets you want to analyze.
3. Configure the type of analysis, visualizations, and insights you want in the report.
4. Click "Generate Report". The AI will analyze your data and produce a comprehensive report.
5. View, download, or share the generated report from the Reports page.

### Using AI Features
1. **Ask AI**:
   - Click the "Ask AI" button in your spreadsheet
   - Type your question in natural language
   - View AI-generated insights and explanations

2. **Data Cleaning**:
   - Select "Clean Data" from the tools menu
   - Review AI-generated suggestions
   - Apply recommended cleaning actions

### Data Inspector
1. Open the Data Inspector panel
2. View column-wise analysis and statistics
3. Check data quality metrics
4. Apply suggested improvements

### Matrix Operations
1. Enter matrix data in the spreadsheet
2. Select the operation type (add, subtract, multiply, etc.)
3. View the results and any error messages
4. Results are displayed with proper formatting

### Correlation Analysis
1. Select the data columns for analysis
2. Choose the correlation method (Pearson, Spearman, or Kendall)
3. View the correlation coefficients and p-values
4. Interpret the results with automatic insights

### PCA Analysis
1. Select the data for dimensionality reduction
2. View the principal components and explained variance
3. Analyze the transformed data

#### Correlation Analysis
- **Multiple Correlation Methods**: 
  - Pearson correlation coefficients
  - Spearman correlation coefficients
  - Kendall tau correlation coefficients
- **Statistical Significance**: p-values for all correlation coefficients
- **Interpretations**: Automatic interpretation of correlation strength and significance

#### Principal Component Analysis (PCA)
- **Dimensionality Reduction**: Reduce high-dimensional data to principal components
- **Explained Variance**: Track variance explained by each component
- **Standardization**: Automatic data standardization for accurate analysis

### Data Management
- **Data Type Detection**: Automatic identification of text and numerical values
- **Data Inspector**: Explore and understand your dataset with basic statistics
- **Version History**: Track changes through timestamps and last modified information

## Technology Stack

### Frontend
- **Framework**: React.js with Next.js for server-side rendering
- **UI Components**: Custom React components
- **State Management**: React Context API and custom hooks
- **Authentication**: Firebase Authentication with Google Sign-In
- **Styling**: CSS Modules and custom theming system

### Backend
- **API Framework**: FastAPI for high-performance Python backend
- **Database**: Firebase Firestore for real-time data storage
- **Authentication**: Firebase Auth for user management
- **AI Integration**: OpenAI GPT-4 for intelligent data analysis
- **Data Analysis**: 
  - NumPy and Pandas for data manipulation
  - scikit-learn for PCA and standardization
  - SciPy for statistical computing

## Getting Started

### Prerequisites
- Node.js (v14.0.0 or later)
- npm (v6.0.0 or later)
- Python 3.8+ (for backend services)
- Firebase account (for backend services)
- OpenAI API key (for AI features)

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
   OPENAI_API_KEY=your-openai-api-key
   ```

5. Run the development server:
   ```bash
   npm run dev
   ```

6. Open [http://localhost:3000](http://localhost:3000) with your browser to see the application.


## Contact

For questions or support, please contact us at ishan.pathak2711@gmail.com or open an issue on GitHub.
