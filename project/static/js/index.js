let initialCameraPosition = {
    eye: { x:100, y: 0, z: -35 },
    center: { x: 0, y: 0, z: 0 },
    up: { x: 0, y: 0, z: 1 }
};

let is3D = true; // Početno stanje je 3D

document.addEventListener('DOMContentLoaded', function() {
    loadAndCreatePlot();
    setupResetButton();  // Poveži dugme sa funkcionalnošću
    const plotElement = document.getElementById('myDiv');
    if (plotElement) {
        Plotly.relayout(plotElement).then(() => {
            const scene = plotElement._fullLayout.scene;
            if (scene && scene.camera) {
                trackCameraRotation(scene.camera);
            }
        });
    }


    const toggleButton = document.getElementById("toggleButton");
    toggleButton.textContent = "2D"; // Dugme počinje s natpisom '2D'

    toggleButton.addEventListener("click", function () {
        if (is3D) {
            loadAndCreatePlot();
            toggleButton.textContent = "3D"; // Kada je u 2D modu, dugme treba da kaže '3D'
        } else {
            loadAndCreatePlot();
            toggleButton.textContent = "2D"; // Kada je u 3D modu, dugme treba da kaže '2D'
        }
        is3D = !is3D; // Obrće stanje prikaza
    });
})

window.addEventListener('resize', function() {
    Plotly.relayout('myDiv', {
        width: window.innerWidth,
        height: window.innerHeight
    });
});




// Funkcija za praćenje rotacije
function trackCameraRotation(currentCamera) {
    if (!initialCameraPosition) return;

    // Izračunaj razliku između trenutne i početne pozicije kamere
    const deltaEye = {
        x: currentCamera.eye.x - initialCameraPosition.eye.x,
        y: currentCamera.eye.y - initialCameraPosition.eye.y,
        z: currentCamera.eye.z - initialCameraPosition.eye.z
    };

    const deltaUp = {
        x: currentCamera.up.x - initialCameraPosition.up.x,
        y: currentCamera.up.y - initialCameraPosition.up.y,
        z: currentCamera.up.z - initialCameraPosition.up.z
    };

    // Izračunaj ugao rotacije oko X, Y i Z osa
    const rotationX = Math.atan2(deltaEye.y, deltaEye.z);
    const rotationY = Math.atan2(deltaEye.x, deltaEye.z);
    const rotationZ = Math.atan2(deltaUp.x, deltaUp.y);

    console.log("Rotation around X axis:", rotationX);
    console.log("Rotation around Y axis:", rotationY);
    console.log("Rotation around Z axis:", rotationZ);
}

// Funkcija za dohvatanje podataka
function fetchData() {
    const loader = document.getElementById('loader');
    if (loader) loader.style.display = 'block';

    const cachedData = sessionStorage.getItem('plotData');
    if (cachedData) {
        console.log('Loading data from cache');
        return Promise.resolve(JSON.parse(cachedData));
    }

    return fetch('http://127.0.0.1:5000/plot_data')
        .then(response => response.json())
        .then(data => {
            sessionStorage.setItem('plotData', JSON.stringify(data));
            console.log('Fetched data:', data);
            return data;
        })
        .catch(error => {
            console.error("Error fetching plot data:", error);
            throw error;
        });
}

function fetchProteinConcentrationData(geneName) {
    return fetch(`http://127.0.0.1:5000/protein_concentration_data?geneName=${geneName}`)
        .then(response => response.json())
        .then(data => {
            // Assuming the response contains the data for young and old donors
            return {
                young: data.youngDonors,
                old: data.oldDonors,
                additionalInfo: data.additionalInfo,
            };
            })
        .catch(error => {
            console.error('Error fetching protein concentration data:', error);
            throw error;
        });
}

// Funkcija za određivanje boje na osnovu vrednosti
function getColor(value, min, max) {

    const colors = ['#522258', '#8C3061', '#C63C51', '#d3904b', '#D97759FF', '#D99359FF', '#D3904BFF'];
    const mid = (min + max) / 2;
    const range1 = mid / 9 - min;
    const range2 = max - mid;

    let valueScaled;
    if (value <= mid) {
        valueScaled = (value - min) / range1;
    } else {
        valueScaled = (value - mid) / range2;
    }

    let colorIndex;
    if (value <= mid) {
        colorIndex = Math.min(Math.floor(valueScaled * (colors.length - 3)), colors.length - 3);
    } else {
        colorIndex = Math.min(Math.floor(valueScaled * 2), 2) + (colors.length - 2);
    }

    return colors[colorIndex];
}


function createPlot(data) {
    const minValue = Math.min(...data.y);
    const maxValue = Math.max(...data.y);
    const colors = data.y.map(value => getColor(value, minValue, maxValue));

    const trace = {
        x: data.z,
        y: data.x,
        z: data.y,
        mode: 'markers',
        marker: {
            size: 20,
            color: colors,
            opacity: 0.7,
            line: { color: 'rgba(217, 217, 217, 0.15)', width: 0 }
        },
        customdata: data.geneNames.map((gene, index) => ({ geneName: gene, dataIndex: index })),
        hovertemplate: 'X: %{x}<br>Y: %{y}<br>Z: %{z}<br>Gene: %{customdata.geneName}<extra></extra>',
        type: 'scatter3d'
    };

    const layout = {
        width: window.innerWidth,
        height: window.innerHeight,
        margin: { l: 0, r: 0, b: 0, t: 0 },
        scene: {
            xaxis: { showgrid: false, zeroline: false, showbackground: false, showticklabels: false },
            yaxis: { showgrid: false, zeroline: false, showbackground: false, showticklabels: false },
            zaxis: { showgrid: false, zeroline: false, showbackground: false, showticklabels: false },
            aspectmode: 'manual',
            aspectratio: { x: 70, y: 150, z: 70 },
            camera: initialCameraPosition
        },
        paper_bgcolor: "#232323",
        plot_bgcolor: "#232323FF",
        font: { color: "#272727" },
        dragmode: 'orbit',
        showlegend: false,
        hovermode: 'closest'
    };

    Plotly.newPlot('myDiv', [trace], layout).then(function() {
        const loader = document.getElementById('loader');
        if (loader) loader.style.display = 'none';

        const plotElement = document.getElementById('myDiv');

        // Consolidate the plotly_relayout event handlers
        // plotElement.on('plotly_relayout', function(eventData) {
        //     console.log("relayout done");
        //
        //     const currentCamera = eventData['scene.camera'];
        //     if (currentCamera) {
        //         const cameraDistance = Math.sqrt(
        //             Math.pow(currentCamera.eye.x, 2) +
        //             Math.pow(currentCamera.eye.y, 2) +
        //             Math.pow(currentCamera.eye.z, 2)
        //         );
        //         const newSize = Math.max(5, Math.min(100, 7 * (4 / cameraDistance)));
        //         console.log(newSize);
        //         Plotly.restyle('myDiv', 'marker.size', Array(data.y.length).fill(newSize));
        //     }
        // });

        // Handle click event on plot points
        plotElement.on('plotly_click', function(eventData) {
            const proteinPlot = document.getElementById('protein-plot');
            proteinPlot.style.display = 'block';
            const geneName = eventData.points[0].customdata.geneName;
            fetchProteinConcentrationData(geneName)
                .then(proteinData => {
                    console.log(proteinData);
                    if (proteinData.young && proteinData.old) {
                        createProteinPLot(proteinData);
                        loadGenePapers(geneName);
                        fillInData(proteinData);
                    } else {
                        console.error("Error: Missing data for plotting.");
                    }
                })
                .catch(error => {
                    console.error("Error fetching protein concentration data:", error);
                });

            function fillInData(proteinData) {
                const infoContainer = document.getElementById("sidebar-content");

                if (proteinData && proteinData.additionalInfo) {
                    infoContainer.innerHTML = `
                        <h3>Protein Information for Gene: ${proteinData.additionalInfo.EntrezGeneSymbol}</h3>
                        <p><strong>Gene Name:</strong> ${proteinData.additionalInfo.TargetFullName}</p>
                        <p><strong>Target:</strong> ${proteinData.additionalInfo.Target}</p>
                        <p><strong>Entrez Gene ID:</strong> ${proteinData.additionalInfo.EntrezGeneID}</p>
                        <p><strong>Organism:</strong> ${proteinData.additionalInfo.Organism}</p>
                        <p><strong>Units:</strong> ${proteinData.additionalInfo.Units}</p>
                        <p><strong>Type:</strong> ${proteinData.additionalInfo.Type}</p>
                        <p><strong>Dilution:</strong> ${proteinData.additionalInfo.Dilution}</p>
                        <h4>Protein Concentration (Young vs Old Donors)</h4>
                    `;
                } else {
                    console.error("Protein data is missing or malformed.");
                }
            }
        });
    });
}

function create2DPlot(data) {
    const minValue = Math.min(...data.y);
    const maxValue = Math.max(...data.y);
    const colors = data.y.map(value => getColor(value, minValue, maxValue));

    const trace = {
        x: data.x, // X ostaje isto
        y: data.y, // Y ostaje isto
        mode: 'markers',
        marker: {
            size: 10,
            color: colors,
            opacity: 0.7,
            line: { color: 'rgba(217, 217, 217, 0.15)', width: 0 }
        },
        customdata: data.geneNames.map((gene, index) => ({ geneName: gene, dataIndex: index })),
        hovertemplate: 'X: %{x}<br>Y: %{y}<br>Gene: %{customdata.geneName}<extra></extra>',
        type: 'scatter' // 2D scatter plot
    };

    const layout = {
        width: window.innerWidth,
        height: window.innerHeight,
        margin: { l: 40, r: 40, b: 40, t: 40 },
        xaxis: { showgrid: true, title: "X Axis" },
        yaxis: { showgrid: true, title: "Y Axis" },
        paper_bgcolor: "#232323",
        plot_bgcolor: "#232323FF",
        font: { color: "#FFFFFF" },
        showlegend: false,
        hovermode: 'closest'
    };

    Plotly.newPlot('myDiv', [trace], layout).then(function() {
        const loader = document.getElementById('loader');
        if (loader) loader.style.display = 'none';

        const plotElement = document.getElementById('myDiv');

        // Consolidate the plotly_relayout event handlers
        // plotElement.on('plotly_relayout', function(eventData) {
        //     console.log("relayout done");
        //
        //     const currentCamera = eventData['scene.camera'];
        //     if (currentCamera) {
        //         const cameraDistance = Math.sqrt(
        //             Math.pow(currentCamera.eye.x, 2) +
        //             Math.pow(currentCamera.eye.y, 2) +
        //             Math.pow(currentCamera.eye.z, 2)
        //         );
        //         const newSize = Math.max(5, Math.min(100, 7 * (4 / cameraDistance)));
        //         console.log(newSize);
        //         Plotly.restyle('myDiv', 'marker.size', Array(data.y.length).fill(newSize));
        //     }
        // });

        // Handle click event on plot points
        plotElement.on('plotly_click', function(eventData) {
            const proteinPlot = document.getElementById('protein-plot');
            proteinPlot.style.display = 'block';
            const geneName = eventData.points[0].customdata.geneName;
            fetchProteinConcentrationData(geneName)
                .then(proteinData => {
                    console.log(proteinData);
                    if (proteinData.young && proteinData.old) {
                        createProteinPLot(proteinData);
                        loadGenePapers(geneName);
                        fillInData(proteinData);
                    } else {
                        console.error("Error: Missing data for plotting.");
                    }
                })
                .catch(error => {
                    console.error("Error fetching protein concentration data:", error);
                });


            function fillInData(proteinData) {
                const infoContainer = document.getElementById("sidebar-content");

                if (proteinData && proteinData.additionalInfo) {
                    infoContainer.innerHTML = `
                        <h3>Protein Information for Gene: ${proteinData.additionalInfo.EntrezGeneSymbol}</h3>
                        <p><strong>Gene Name:</strong> ${proteinData.additionalInfo.TargetFullName}</p>
                        <p><strong>Target:</strong> ${proteinData.additionalInfo.Target}</p>
                        <p><strong>Entrez Gene ID:</strong> ${proteinData.additionalInfo.EntrezGeneID}</p>
                        <p><strong>Organism:</strong> ${proteinData.additionalInfo.Organism}</p>
                        <p><strong>Units:</strong> ${proteinData.additionalInfo.Units}</p>
                        <p><strong>Type:</strong> ${proteinData.additionalInfo.Type}</p>
                        <p><strong>Dilution:</strong> ${proteinData.additionalInfo.Dilution}</p>
                        <h4>Protein Concentration (Young vs Old Donors)</h4>
                    `;
                } else {
                    console.error("Protein data is missing or malformed.");
                }
            }
        });
    });
}




// Funkcija za kreiranje 2D plot-a
function createProteinPLot(data) {
    // Osiguraj da podaci postoje
    if (!data.young || !data.old) {
        console.error("Error: Missing data for plotting.");
        return;
    }

    // Dodaj x vrednosti ako nisu pružene
    const xValues = data.x || [...Array(data.young.length).keys()];  // Koristi indekse ako x vrednosti nisu date

    // Razdvajanje na boje za mlade (young) i stare (old)
    const traceYoung = {
        x: xValues,
        y: data.young,
        mode: 'markers',
        marker: {
            size: 10,
            color: '#d3904b', // Boja za mlade (light blue)
            opacity: 1,
            line: { color: 'rgba(217, 217, 217, 0.14)', width: 0.5 }
        },
        name: 'Young Donors',
        hovertemplate: 'X: %{x}<br>Y: %{y}<extra></extra>',
        type: 'scatter'
    };

    const traceOld = {
        x: xValues,
        y: data.old,
        mode: 'markers',
        marker: {
            size: 10,
            color: '#8C3061', // Boja za stare (red)
            opacity: 1,
            line: { color: 'rgba(217, 217, 217, 0.14)', width: 0.5 }
        },
        name: 'Old Donors',
        hovertemplate: 'X: %{x}<br>Y: %{y}<extra></extra>',
        type: 'scatter'
    };

    // Dobijanje širine sidebar-a i postavljanje visine na željenu vrednost (30%)
    const sidebarWidth = document.getElementById('sidebar').offsetWidth; // Širina sidebar-a
    const plotHeight = window.innerHeight * 0.3; // Visina 30% od visine prozora

    // Layout za plot
    const layout = {
        width: sidebarWidth,  // Koristi širinu sidebar-a
        height: plotHeight,   // Koristi visinu 30% od prozora
        margin: { l: 20, r: 20, b: 40, t: 40 },  // Opcionalni margini
        paper_bgcolor: "#000000",
        plot_bgcolor: "#000000",
        font: { color: "#ffffff" },
        showlegend: true,
        hovermode: 'closest'
    };

    // Kreiraj plot u #protein-plot div-u
    Plotly.newPlot('protein-plot', [traceYoung, traceOld], layout);
}

function loadGenePapers(geneName) {
    let allPapers = [];
    let visiblePapers = 3; // Početno prikazivanje 3 rada

    // Provera da li elementi postoje
    const sidebarContent = document.getElementById("scientific-paper");
    if (!sidebarContent) {
        console.error("Error: Element #scientific-paper not found.");
        return;
    }

    // Kreiraj "Show More" dugme ako ne postoji
    let loadMoreBtn = document.getElementById("loadMoreBtn");
    if (!loadMoreBtn) {
        loadMoreBtn = document.createElement("button");
        loadMoreBtn.id = "loadMoreBtn";
        loadMoreBtn.innerText = "Show More";
        loadMoreBtn.style.marginTop = "10px";
        sidebarContent.after(loadMoreBtn);
    }

    // Funkcija za prikaz radova
    function displayPapers() {
        sidebarContent.innerHTML = "Scientific papers related to gene:"; // Očisti prethodni sadržaj

        const list = document.createElement("ul");
        for (let i = 0; i < Math.min(visiblePapers, allPapers.length); i++) {
            const item = document.createElement("li");
            item.innerHTML = `<a href="${allPapers[i]}" target="_blank">PubMed link: ${allPapers[i]}</a>`;
            list.appendChild(item);
        }

        sidebarContent.appendChild(list);

        // Dodaj Show More dugme ako je potrebno
        if (visiblePapers < allPapers.length) {
            loadMoreBtn.style.display = "block";
            loadMoreBtn.innerText = "Show More";
        } else {
            loadMoreBtn.style.display = "block";
            loadMoreBtn.innerText = "Show Less";
        }

        // Omogućiti skrolovanje unutar scientific-paper div-a
        sidebarContent.style.maxHeight = "300px";
        sidebarContent.style.overflowY = "auto";
    }

    // Klik na Show More / Show Less
    loadMoreBtn.addEventListener("click", function () {
        if (loadMoreBtn.innerText === "Show More") {
            visiblePapers = allPapers.length; // Učitaj sve radove
        } else {
            visiblePapers = 3; // Resetuj na 3 rada
        }
        displayPapers(); // Ponovo prikaži radove
    });

    // Fetch podaci sa servera
    fetch(`/get_gene_papers?gene_name=${geneName}`)
        .then(response => response.json())
        .then(data => {
            if (data.pubmed_links && data.pubmed_links.length > 0) {
                allPapers = data.pubmed_links;
                visiblePapers = 3; // Resetuj početni broj prikazanih radova
                displayPapers();
            } else {
                sidebarContent.innerHTML = "<p>No related papers found.</p>";
            }
        })
        .catch(error => console.error("Error fetching data:", error));
}




// Funkcija za glatko resetovanje kamere
function smoothResetCameraPosition() {
    if (!initialCameraPosition) {
        console.error("Initial camera position is not set.");
        return;
    }
    const plotElement = document.getElementById('myDiv');

    if (!plotElement || !plotElement.layout || !plotElement.layout.scene) {
        console.error("Plot element or layout is not available.");
        return;
    }

    const currentCamera = plotElement.layout.scene.camera;
    console.log("Current camera before reset:", currentCamera);

    resetToInitialPosition();

    function resetToInitialPosition() {
        const currentCamera = plotElement.layout.scene.camera;
        const currentCenter = currentCamera.center || { x: 0, y: 0, z: 0 };
        const currentUp = currentCamera.up || { x: 0, y: 0, z: 1 };

        const duration = 1000; // Trajanje animacije u milisekundama
        const startTime = performance.now();

        function animateCamera(currentTime) {
            const elapsedTime = currentTime - startTime;
            const progress = Math.min(elapsedTime / duration, 1);

            const newCamera = {
                eye: {
                    x: currentCamera.eye.x + (initialCameraPosition.eye.x - currentCamera.eye.x) * progress,
                    y: currentCamera.eye.y + (initialCameraPosition.eye.y - currentCamera.eye.y) * progress,
                    z: currentCamera.eye.z + (initialCameraPosition.eye.z - currentCamera.eye.z) * progress,
                },
                center: {
                    x: currentCenter.x + (initialCameraPosition.center.x - currentCenter.x) * progress,
                    y: currentCenter.y + (initialCameraPosition.center.y - currentCenter.y) * progress,
                    z: currentCenter.z + (initialCameraPosition.center.z - currentCenter.z) * progress,
                },
                up: {
                    x: currentUp.x + (initialCameraPosition.up.x - currentUp.x) * progress,
                    y: currentUp.y + (initialCameraPosition.up.y - currentUp.y) * progress,
                    z: currentUp.z + (initialCameraPosition.up.z - currentUp.z) * progress,
                }
            };

            Plotly.relayout(plotElement, {
                'scene.camera': newCamera
            });

            if (progress < 1) {
                requestAnimationFrame(animateCamera);
            }
        }

        requestAnimationFrame(animateCamera);
    }
}

// Poveži reset dugme sa funkcionalnošću
function setupResetButton() {
    const resetButton = document.getElementById('resetButton');
    if (resetButton) {
        resetButton.addEventListener('click', function() {
            console.log("Reset button clicked."); // Ispisujemo klik na dugme
            smoothResetCameraPosition();  // Smoothly reset the camera position
        });
    }
}


// Glavna funkcija koja pokreće sve
function loadAndCreatePlot() {
    fetchData()
        .then(data => {
            if(is3D){
                createPlot(data);  // Kreiraj plot koristeći podatke
            }else{
                create2DPlot(data);
            }

            // simulateClickOnCenter();
        })
        .catch(error => {
            console.error("Error in loading or creating plot:", error);
        });
}


