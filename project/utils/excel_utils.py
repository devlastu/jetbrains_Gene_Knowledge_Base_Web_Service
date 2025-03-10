import pandas as pd
import numpy as np
import plotly.express as px




# Funkcija za kreiranje 3D volcano plot-a
def create_volcano_plot_3d(data):
    # Provera da li su potrebni podaci prisutni
    required_columns = ['adj.P.Val', 'EntrezGeneSymbol', 'logFC']
    missing_columns = [col for col in required_columns if col not in data.columns]

    if missing_columns:
        raise ValueError(f"Required columns are missing: {', '.join(missing_columns)}")

    # Računanje -log10 za adj.P.Val
    data['-log10(adj.P.Val)'] = -np.log10(data['adj.P.Val'])

    data['Z_value'] = 0  # Postavljanje Z_value na 0 za sve podatke


    # Kreiranje 3D volcano plot-a sa permutovanim koordinatama
    fig = px.scatter_3d(data_frame=data,
                         x='logFC',  # X postaje -log10(adj.P.Val)
                         y='-log10(adj.P.Val)',  # Y postaje logFC
                         z='Z_value',  # Z koordinate će biti postavljene na 0 ili neku drugu vrednost
                         color='-log10(adj.P.Val)',  # Boja prema značajnosti
                         hover_data=['EntrezGeneSymbol'],
                         title="3D Volcano Plot (Shifted Axes)",
                         labels={"-log10(adj.P.Val)": "Y Axis (-Log10 Adjusted P-Value)",
                                 "logFC": "X Axis (Log2 Fold Change)",
                                 "Z_value": "Z Axis (Fixed 0)"})

    # Podesi izgled plot-a
    fig.update_layout(
        scene=dict(
            xaxis_title="X Axis (Log2 Fold Change)",  # Preimenovano zbog zamene
            yaxis_title="Y Axis (-Log10 Adjusted P-Value)",
            zaxis_title="Z Axis (Fixed 0)",  # Z se postavlja kao statička vrednost
            camera=dict(eye=dict(x=2, y=1, z=0.5))  # Početni ugao kamere
        ),
        showlegend=False
    )

    # Čuvanje plot-a u lokalnom fajlu
    plot_filename = 'volcano_plot_3d_shifted.html'
    fig.write_html(plot_filename)
    return plot_filename


# Funkcija za čitanje podataka iz Excel fajla
def read_excel_data(file_path, sheet):
    # Učitavanje Excel fajla i čitanje sheet-a "S4B limma results"
    excel_data = pd.ExcelFile(file_path)

    # Provera dostupnih sheet-ova
    if 'S4B limma results' not in excel_data.sheet_names:
        raise ValueError("Sheet 'S4B limma results' not found in the Excel file.")

    # Učitavanje podataka sa sheet-a, preskakanje prvog reda
    s4b_data = excel_data.parse(sheet, skiprows=2)

    # Uklanjanje eventualnih praznih kolona ili nepotrebnih razmaka u nazivima kolona
    s4b_data.columns = s4b_data.columns.str.strip()

    # Čišćenje podataka, ako je potrebno, uklanjanje praznih kolona
    s4b_data = s4b_data.loc[:, ~s4b_data.columns.str.contains('^Unnamed')]

    return s4b_data

# Funkcija za kreiranje volcano plot-a
def create_volcano_plot(data):
    # Provera da li su potrebni podaci prisutni
    required_columns = ['adj.P.Val', 'EntrezGeneSymbol', 'logFC']
    missing_columns = [col for col in required_columns if col not in data.columns]

    if missing_columns:
        raise ValueError(f"Required columns are missing: {', '.join(missing_columns)}")

    # Računanje -log10 za adj.P.Val
    data['-log10(adj.P.Val)'] = -np.log10(data['adj.P.Val'])

    # Kreiranje volcano plot-a
    fig = px.scatter(data_frame=data,
                     x='logFC',  # Log2 razlika (ako postoji logFC u podacima)
                     y='-log10(adj.P.Val)',
                     color='-log10(adj.P.Val)',  # Boja prema značajnosti
                     hover_data=['EntrezGeneSymbol'],  # Pokazivanje imena gena na hoveru
                     title="Volcano Plot",
                     labels={"logFC": "Log2 Fold Change", "-log10(adj.P.Val)": "-Log10 Adjusted P-Value"})

    # Podesi izgled plot-a
    fig.update_layout(
        xaxis_title="Log2 Fold Change",
        yaxis_title="-Log10 Adjusted P-Value",
        showlegend=False
    )

    # Čuvanje plot-a u lokalnom fajlu
    plot_filename = 'volcano_plot.html'
    fig.write_html(plot_filename)
    return plot_filename

