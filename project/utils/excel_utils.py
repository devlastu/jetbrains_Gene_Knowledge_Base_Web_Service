import pandas as pd
import numpy as np
import plotly.express as px


# Funkcija za čitanje podataka iz Excel fajla
def read_excel_data(file_path, sheet):
    # Load the Excel file and read the sheet "S4B limma results"
    excel_data = pd.ExcelFile(file_path)

    # Check if the sheet exists
    if 'S4B limma results' not in excel_data.sheet_names:
        raise ValueError("Sheet 'S4B limma results' not found in the Excel file.")

    # Read the data from the sheet, skipping the first row
    s4b_data = excel_data.parse(sheet, skiprows=2)

    # Remove any empty columns or extra spaces in column names
    s4b_data.columns = s4b_data.columns.str.strip()

    # Clean the data if needed, removing any empty columns
    s4b_data = s4b_data.loc[:, ~s4b_data.columns.str.contains('^Unnamed')]

    return s4b_data


