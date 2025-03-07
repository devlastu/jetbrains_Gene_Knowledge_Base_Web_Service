from flask import Flask, render_template
import plotly.express as px
from utils.excel_utils import read_excel_data, create_volcano_plot

app = Flask(__name__)

@app.route('/')
def index():
    # Path to your Excel file
    file_path = 'data/NIHMS1635539-supplement-1635539_Sup_tab_4.xlsx'

    try:
        # Read the data
        s4b_data = read_excel_data(file_path)

        # Generate the volcano plot using the function from excel_utils.py
        plot_filename = create_volcano_plot(s4b_data)

        # Open the saved plot (HTML file) and embed it into the page with utf-8 encoding
        with open(plot_filename, 'r', encoding='utf-8') as plot_file:
            plot_html = plot_file.read()

        # Pass the plot HTML and some data to the template
        return render_template('index.html', plot=plot_html, data=s4b_data.head().to_html())

    except Exception as e:
        # Handle any error that may occur
        return f"An error occurred: {str(e)}"

if __name__ == '__main__':
    app.run()
