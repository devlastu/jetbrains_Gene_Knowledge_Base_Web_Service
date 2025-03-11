from pprint import pprint

import fprint
import requests
from flask import Flask, jsonify, render_template, request
import pandas as pd
import numpy as np
import plotly.express as px
from utils.excel_utils import read_excel_data
from flask_cors import CORS

app = Flask(__name__)
CORS(app)
MYGENE_API_BASE = "https://mygene.info/v3"


@app.route("/get_gene_papers", methods=["GET"])
def get_gene_papers():
    gene_name = request.args.get("gene_name")

    if not gene_name:
        return jsonify({"error": "Gene name is required"}), 400

    # 1. Pronaći ID gena
    try:
        response = requests.get(f"{MYGENE_API_BASE}/query?q=symbol:{gene_name}")
        response.raise_for_status()
        data = response.json()
    except requests.exceptions.RequestException as e:
        return jsonify({"error": f"Failed to fetch gene ID: {str(e)}"}), 500

    if not data.get("hits"):
        return jsonify({"error": "Gene not found"}), 404

    gene_id = data["hits"][0]["_id"]

    # 2. Dohvatiti podatke o genu pomoću ID-ja
    try:
        response = requests.get(f"{MYGENE_API_BASE}/gene/{gene_id}")
        response.raise_for_status()
        gene_data = response.json()
    except requests.exceptions.RequestException as e:
        return jsonify({"error": f"Failed to fetch gene info: {str(e)}"}), 500


    # 3. Ekstraktovati samo PubMed ID-jeve
    pubmed_ids = set()
    # Iz `generif`
    if "generif" in gene_data:
        for entry in gene_data["generif"]:
            if "pubmed" in entry:
                pubmed_ids.add(entry["pubmed"])


    # 4. Kreirati PubMed linkove
    pubmed_links = [f"https://pubmed.ncbi.nlm.nih.gov/{pubmed_id}/" for pubmed_id in pubmed_ids]

    return jsonify({"gene_name": gene_name, "pubmed_links": pubmed_links})




# Route for generating the 3D volcano plot data
@app.route('/plot_data')
def plot_data():
    file_path = 'data/NIHMS1635539-supplement-1635539_Sup_tab_4.xlsx'

    try:
        # Učitavanje podataka
        s4b_data = read_excel_data(file_path, "S4B limma results")

        print(f"Prije normalizacije x: {s4b_data['logFC'].head()}")

        # Računanje -log10 za adj.P.Val
        s4b_data['-log10(adj.P.Val)'] = -np.log10(s4b_data['adj.P.Val'])
        s4b_data['Z_value'] = 0  # Z-axis is fixed at 0 for now
        s4b_data['Z_value'] = np.random.uniform(-3, 3, len(s4b_data))

        # Ekstrakcija podataka koji su potrebni za 3D plot
        plot_data = {
            'x': s4b_data['logFC'].tolist(),
            'y': s4b_data['-log10(adj.P.Val)'].tolist(),
            'z': s4b_data['Z_value'].tolist(),
            'color': s4b_data['-log10(adj.P.Val)'].tolist(),
            'hover_data': s4b_data['EntrezGeneSymbol'].tolist(),
            'geneNames': s4b_data['EntrezGeneSymbol'].tolist(),  # Add gene name here
            'logFC': s4b_data['logFC'].tolist(),
            'adj_P_Val': s4b_data['adj.P.Val'].tolist(),
            # Add any other relevant fields here if needed
        }

        return jsonify(plot_data)  # Send the data in JSON format

    except Exception as e:
        return jsonify({"error": str(e)})


@app.route('/protein_concentration_data')
def protein_concentration_data():
    gene_name = request.args.get('geneName')  # Get the gene name from the query parameter
    file_path = 'data/NIHMS1635539-supplement-1635539_Sup_tab_4.xlsx'

    try:
        # Load the data from the Excel file
        s4b_data = read_excel_data(file_path, "S4A values")
        # s4b_data_additional = read_excel_data(file_path, "S4A values")  # For additional information

        # Filter the data for the requested gene
        gene_data = s4b_data[s4b_data['EntrezGeneSymbol'] == gene_name]
        # gene_data_additional = s4b_data_additional[s4b_data_additional['EntrezGeneSymbol'] == gene_name]

        if gene_data.empty :
            return jsonify({"error": f"No data found for gene {gene_name}"}), 404

        # Extract protein concentration data for young and old donors
        young_columns = [col for col in gene_data.columns if 'YD' in col]
        old_columns = [col for col in gene_data.columns if 'OD' in col or 'PD' in col]

        young_donors = gene_data[young_columns].values.flatten().tolist()
        old_donors = gene_data[old_columns].values.flatten().tolist()

        # Extract additional information about the gene from S4B table
        additional_info = {
            "TargetFullName": gene_data["TargetFullName"].values[0],
            "Target": gene_data["Target"].values[0],
            "EntrezGeneID": gene_data["EntrezGeneID"].values[0],
            "EntrezGeneSymbol": gene_data["EntrezGeneSymbol"].values[0],
            "Organism": gene_data["Organism"].values[0],
            "Units": gene_data["Units"].values[0],
            "Type": gene_data["Type"].values[0],
            "Dilution": gene_data["Dilution"].values[0],
        }

        # Return the protein concentration and additional gene information
        print(additional_info)
        return jsonify({
            "youngDonors": young_donors,
            "oldDonors": old_donors,
            "additionalInfo": additional_info
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 500



@app.route('/')
def index():
    return render_template('index.html')

if __name__ == '__main__':
    app.run(debug=True)
