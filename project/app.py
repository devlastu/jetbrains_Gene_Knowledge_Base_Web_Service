from flask import Flask, jsonify, render_template
import pandas as pd
import numpy as np
import plotly.express as px
from utils.excel_utils import read_excel_data
from flask_cors import CORS

app = Flask(__name__)

CORS(app)

# Route for generating the 3D volcano plot data
@app.route('/plot_data')
def plot_data():
    file_path = 'data/NIHMS1635539-supplement-1635539_Sup_tab_4.xlsx'

    try:
        # Učitavanje podataka
        s4b_data = read_excel_data(file_path)

        # Računanje -log10 za adj.P.Val
        s4b_data['-log10(adj.P.Val)'] = -np.log10(s4b_data['adj.P.Val'])
        s4b_data['Z_value'] = 0  # Z-axis is fixed at 0 for now

        # Ekstrakcija podataka koji su potrebni za 3D plot
        plot_data = {
            'x': s4b_data['Z_value'].tolist(),
            'y': s4b_data['logFC'].tolist(),
            'z': s4b_data['-log10(adj.P.Val)'].tolist(),
            'color': s4b_data['-log10(adj.P.Val)'].tolist(),
            'hover_data': s4b_data['EntrezGeneSymbol'].tolist()
        }

        return jsonify(plot_data)  # Send the data in JSON format

    except Exception as e:
        return jsonify({"error": str(e)})

@app.route('/')
def index():
    return render_template('index.html')

if __name__ == '__main__':
    app.run(debug=True)
