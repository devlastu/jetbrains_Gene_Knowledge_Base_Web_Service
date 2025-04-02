from pprint import pprint

import fprint
import requests
from bs4 import BeautifulSoup
from flask import Flask, jsonify, render_template, request, url_for
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
    print(gene_name)

    if not gene_name:
        return jsonify({"error": "Gene name is required"}), 400

    # Find the ID of the Gene
    try:
        response = requests.get(f"{MYGENE_API_BASE}/query?q=symbol:{gene_name}")
        response.raise_for_status()
        data = response.json()
    except requests.exceptions.RequestException as e:
        return jsonify({"error": f"Failed to fetch gene ID: {str(e)}"}), 500

    if not data.get("hits"):
        return jsonify({"error": "Gene not found"}), 404

    gene_id = data["hits"][0]["_id"]

    # 2.Fetch the data using gene ID
    try:
        response = requests.get(f"{MYGENE_API_BASE}/gene/{gene_id}")
        response.raise_for_status()
        gene_data = response.json()
    except requests.exceptions.RequestException as e:
        return jsonify({"error": f"Failed to fetch gene info: {str(e)}"}), 500

    # 3. Extract PubMedId-s
    pubmed_ids = set()
    # Iz `generif`
    if "generif" in gene_data:
        for entry in gene_data["generif"]:
            if "pubmed" in entry:
                pubmed_ids.add(entry["pubmed"])

    # 4.Create PubMed links
    pubmed_links = [f"https://pubmed.ncbi.nlm.nih.gov/{pubmed_id}/" for pubmed_id in pubmed_ids]


    return jsonify({"gene_name": gene_name, "pubmed_papers": pubmed_links})




# Route for generating the 3D volcano plot data
@app.route('/plot_data')
def plot_data():
    file_path = 'data/NIHMS1635539-supplement-1635539_Sup_tab_4.xlsx'

    try:
        # Loading the data
        s4b_data = read_excel_data(file_path, "S4B limma results")

        print(f"Prije normalizacije x: {s4b_data['logFC'].head()}")

        # Calculating -log10 for adj.P.Val
        s4b_data['-log10(adj.P.Val)'] = -np.log10(s4b_data['adj.P.Val'])
        s4b_data['Z_value'] = np.random.uniform(-3, 3, len(s4b_data))

        # Filter the data based on logFC and adj.P.Val
        important_genes = s4b_data[(abs(s4b_data['logFC']) > 0.5) & (s4b_data['adj.P.Val'] < 0.05)]

        # Display the filtered important genes
        print(f"Important: {important_genes[['EntrezGeneSymbol', 'logFC', 'adj.P.Val']]}")

        # Extraxt the data for 3D
        plot_data = {
            'x': s4b_data['logFC'].tolist(),
            'y': s4b_data['-log10(adj.P.Val)'].tolist(),
            'z': s4b_data['Z_value'].tolist(),
            'color': s4b_data['-log10(adj.P.Val)'].tolist(),
            'hover_data': s4b_data['EntrezGeneSymbol'].tolist(),
            'geneNames': s4b_data['EntrezGeneSymbol'].tolist(),
            'logFC': s4b_data['logFC'].tolist(),
            'adj_P_Val': s4b_data['adj.P.Val'].tolist(),
            'important': important_genes.apply(
                lambda row: {
                    'geneSymbol': row['EntrezGeneSymbol'],
                    'logFC': row['logFC'],
                    'adj.P.Val': row['-log10(adj.P.Val)']
                },
                axis=1
            ).tolist()  # Send important gene names with additional data
        }
        print(max(s4b_data['-log10(adj.P.Val)'].tolist()))
        print(min(s4b_data['-log10(adj.P.Val)'].tolist()))
        return jsonify(plot_data)  # Send the data in JSON format

    except Exception as e:
        return jsonify({"error": str(e)})




#View for generating 2D Protein Data plot
@app.route('/protein_concentration_data')
def protein_concentration_data():
    gene_name = request.args.get('geneName')  # Uzimanje imena gena iz query parametra
    file_path = 'data/NIHMS1635539-supplement-1635539_Sup_tab_4.xlsx'

    try:
        #Loading data from both data sheets
        s4a_data = read_excel_data(file_path, "S4A values")
        s4b_data = read_excel_data(file_path, "S4B limma results")  # Dodajemo ekspresione podatke

        # Filtering on gene
        gene_data = s4a_data[s4a_data['EntrezGeneSymbol'] == gene_name]
        gene_exp_data = s4b_data[s4b_data['EntrezGeneSymbol'] == gene_name]

        if gene_data.empty:
            return jsonify({"error": f"No concentration data found for gene {gene_name}"}), 404

        if gene_exp_data.empty:
            return jsonify({"error": f"No expression data found for gene {gene_name}"}), 404

        #Extraxt data about old and young donors for protein plot
        young_columns = [col for col in gene_data.columns if 'YD' in col]
        old_columns = [col for col in gene_data.columns if 'OD' in col or 'PD' in col]

        young_donors = gene_data[young_columns].values.flatten().tolist()
        old_donors = gene_data[old_columns].values.flatten().tolist()

        #Bonus info for displaying in web app
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

        # Bonus info on gene expression from data sheet
        expression_info = {
            "logFC": gene_exp_data["logFC"].values[0],  # Log fold change
            "adj.P.Val": gene_exp_data["adj.P.Val"].values[0],  # P-vrednost nakon korekcije
            "P.Value": gene_exp_data["P.Value"].values[0],  # Originalna P-vrednost
            "B": gene_exp_data["B"].values[0],  # B-score (verovatnoća diferencijalne ekspresije)
            "t": gene_exp_data["t"].values[0],  # t-statistika
            "AveExpr": gene_exp_data["AveExpr"].values[0]  # Prosečna ekspresija
        }

        #Replacing possible NaN values
        additional_info = {k: (v if pd.notna(v) else "N/A") for k, v in additional_info.items()}
        expression_info = {k: (v if pd.notna(v) else "N/A") for k, v in expression_info.items()}

        # Sending data as a JSON
        return jsonify({
            "youngDonors": young_donors,
            "oldDonors": old_donors,
            "additionalInfo": additional_info,
            "expressionInfo": expression_info
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/')
def index():
    model_url = url_for('static', filename='models/gltf/Flower/Flower.glb')
    return render_template('index.html', model_url=model_url)


if __name__ == '__main__':
    app.run(debug=True)
