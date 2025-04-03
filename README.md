# Gene Knowledge Base Web Service🧬

## Overview

The **Gene Knowledge Base Web Service** is a Flask-based web application designed to visualize protein activity levels and related scientific data. The main objective of this service is to create an interactive volcano plot showing the differences in protein activity levels. This is achieved using the **NIHMS1635539-supplement-1635539_Sup_tab_4.xlsx** dataset, and users can explore the data by interacting with the plot. 🔬

Additionally, the service allows users to click on plot points to view related data through boxplots 📊 and integrate gene-related scientific papers by using the **MyGene.info** API. 📑

## Features

- **Interactive Volcano Plot** 🌋: Visualize protein activity levels using the **adj.P.Val** column as a significance metric.
- **Boxplot on Click** 🔲: Clicking a plot point will display a boxplot comparing protein concentrations in young vs. old donors.
- **Scientific Paper Integration** (Bonus Feature) 📚: For each gene, retrieve and display related scientific papers using the **MyGene.info** API.
- **3D Plot for Immersive User Experience** 🖥️: Utilize **Three.js** to create a 3D interactive volcano plot, allowing users to explore the data in a more engaging and immersive way. This enables users to interact with the plot from various angles and depths, providing an enhanced understanding of protein activity levels and their relationships.
- **Search Functionality** 🔍: Implement a search feature to enable users to easily find and navigate specific genes or data points within the plot. This helps in quickly locating genes of interest and improves overall user experience by streamlining navigation.

## Technologies Used

- **Flask** 🐍: For building the web application and backend server.
- **Plotly** 📊: For creating interactive plots, particularly protein volcano plots (sidebar plot).
- **Three.js** 🎮: For rendering immersive 3D visualizations and creating a more interactive experience for users. The 3D volcano plot provides an engaging way to explore the protein activity data.
- **Pandas** 📈: For data manipulation and processing.
- **Requests** 🌐: For accessing external APIs (such as the MyGene.info API for scientific paper integration).
- **JavaScript (index.js)** 💻: For implementing interactive frontend functionalities.
- **HTML/CSS** 💅: For designing the user interface.

# Project tree

* [requirements.txt](./requirements.txt)       
* [app.py](./app.py)                           # Flask application entry point
* [data](./data)                               # Contains datasets
  * [NIHMS1635539-supplement-1635539_Sup_tab_4.xlsx](./data/NIHMS1635539-supplement-1635539_Sup_tab_4.xlsx)
* [static](./static)                           # Static files
  * [audio](./static/audio)
  * [css](./static/css)
  * [images](./static/images)
  * [js](./static/js)
    * [index.js](./static/js/index.js)         
* [models](./models)                           # 3D models and related files
  * [gltf](./models/gltf)
  * [Flower](./models/Flower)
* [templates](./templates)                     # HTML templates
  * [index.html](./templates/index.html)       # Main webpage
* [utils](./utils)                             # Utility scripts
  * [excel_utils.py](./utils/excel_utils.py)   # Functions for handling Excel data

## Requirements

- Python 3.x 🐍
- Flask 🌐
- Plotly 📊 
- Three.js (for interactive visualizations, immersive UI)
- Pandas 📈 (for data manipulation)
- Requests 🌍 (for accessing external APIs, if the bonus feature is implemented)
## Installation and Setup

### Clone the repository

First, clone the repository to your local machine:

```bash
git clone <repository_url>
cd Gene-Knowledge-Base-Web-Service
```

## Install Dependencies

- Create a virtual environment and install the required Python packages:
```bash
python3 -m venv venv
.venv/bin/activate  # On Windows use `venv\Scripts\activate`
pip install -r requirements.txt
```

## Data Files

- Ensure that the necessary data files (NIHMS1635539-supplement-1635539_Sup_tab_4.xlsx) are placed in the data directory.

## Running the Application

-Start the Flask application by running:

```bash
python app.py
```
## Usage

- Navigate to the main webpage 🌐.

- Enjoy the interactive volcano plot peacefully 🌋🎶.

- Toggle between the 2D and 3D plots 🛠️. You can switch views to explore the data in both dimensions for a better understanding of the protein activity levels.

- Click on points in the volcano plot to display corresponding boxplots 📊.

- Use the search feature 🔍 to find specific genes or data points, making navigation faster and more efficient.

- Explore more about the corresponding gene by viewing related scientific papers 📚 displayed for selected genes.
