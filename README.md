# OneData - Advanced Data Analysis Spreadsheet Application

![OneData Logo](public/logo.png)

## Overview

OneData is a modern web-based spreadsheet application with advanced data analysis capabilities. It combines the familiarity of spreadsheet interfaces with powerful analytics, visualizations, and interactive dashboards, all within a collaborative environment.

## Features

### Core Spreadsheet Functionality
- **Intuitive Spreadsheet Interface**: Excel-like grid with cell editing, formulas, and formatting
- **Data Import/Export**: Support for CSV and Excel files with dependency tracking
- **Real-time Collaboration**: Multiple users can work on the same document simultaneously
- **Auto-saving**: Automatic saving of changes to prevent data loss

### Advanced Data Analysis
- **Regression Analysis**: Run linear and logistic regression models directly in your spreadsheet
- **Correlation Analysis**: Identify relationships between variables with correlation matrices and visualizations
- **Principal Component Analysis (PCA)**: Reduce dimensionality of complex datasets
- **Matrix Operations**: Perform advanced matrix calculations (inversion, multiplication, determinants)
- **Time Series Forecasting**: Predict future values based on historical data

### Visualization Tools
- **Interactive Charts**: Create bar, line, pie, doughnut, polar area, and radar charts
- **Chart Customization**: Fully customize colors, labels, and display options
- **Scatter Plots**: Visualize relationships between variables
- **ROC Curves**: Evaluate classification model performance

### Dashboard Functionality
- **Interactive Dashboards**: Create custom dashboards with multiple visualizations
- **Live Data Connection**: Dashboards update automatically when source data changes
- **Drag-and-Drop Interface**: Easily resize and reposition dashboard elements
- **Sharing Options**: Share dashboards with team members

### AI Integration
- **Data Analysis Assistant**: Ask questions about your data in natural language
- **Chart Recommendations**: AI suggests appropriate chart types based on your data
- **Data Cleaning Suggestions**: Get recommendations for handling missing values and outliers
- **Natural Language Queries**: Generate insights without writing complex formulas

### Data Management
- **Data Cleaning Tools**: Remove outliers, fill missing values, normalize data
- **Data Type Detection**: Automatic identification of text, numerical, and date values
- **Template Library**: Pre-built templates for common analysis scenarios
- **Version History**: Track changes and revert to previous versions if needed

## Technology Stack

- **Frontend**: React.js, Next.js, Chart.js, Handsontable
- **Backend**: Firebase (Authentication, Firestore, Cloud Functions)
- **Data Analysis**: TensorFlow.js, math.js
- **State Management**: React Context API
- **Styling**: CSS Modules

## Getting Started

### Prerequisites
- Node.js (v14.0.0 or later)
- npm (v6.0.0 or later)
- Firebase account (for backend services)

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/onedata.git
   cd onedata
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up environment variables:
   Create a `.env.local` file in the root directory with your Firebase configuration:
   ```
   NEXT_PUBLIC_FIREBASE_API_KEY=your-api-key
   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-auth-domain
   NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
   NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-storage-bucket
   NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your-messaging-sender-id
   NEXT_PUBLIC_FIREBASE_APP_ID=your-app-id
   ```

4. Run the development server:
   ```bash
   npm run dev
   ```

5. Open [http://localhost:3000](http://localhost:3000) with your browser to see the application.

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

### Creating Dashboards
1. Navigate to the Dashboards section
2. Click "New Dashboard"
3. Add charts from your spreadsheets
4. Arrange and resize elements as needed
5. Charts will automatically update when the source data changes

### Using AI Features
1. Click the "Ask AI" button in the top-right corner
2. Type your question about the data
3. Review the AI-generated insights and visualizations

## Contributing

We welcome contributions to OneData! Please see our [CONTRIBUTING.md](CONTRIBUTING.md) for details on how to submit pull requests, report bugs, and suggest features.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- Handsontable for the spreadsheet component
- Chart.js for visualization capabilities
- Firebase for backend services
- The open-source community for various libraries and tools that made this project possible

---

## Contact

For questions or support, please contact us at support@onedata.app or open an issue on GitHub.
