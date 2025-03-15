import * as THREE from 'three';
import CameraControls from 'camera-controls';

// Tooltip i osnovne promenljive
const tooltip = document.getElementById('myDiv');
const proteinPlot = document.getElementById('protein-plot');
let scene, camera, renderer, cameraControls, raycaster, mouse, points, mousePointer;
// Kreiraj novi tooltip element
const info = document.getElementById("elem-info");
// Omogućavanje CameraControls
CameraControls.install({ THREE: THREE });
let intersections = []


function init() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000);

    renderer = new THREE.WebGLRenderer();
    renderer.setSize(window.innerWidth, window.innerHeight);
    tooltip.appendChild(renderer.domElement);

    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 0, -30);
    // Add listener to call onMouseMove every time the mouse moves in the browser window
    document.addEventListener('mousemove', onMouseMove, false);
    document.addEventListener('click', onClick, false); // Dodajemo event listener za click

    console.log("Scene and camera initialized:", scene, camera); // Check initialization


    // Inicijalizacija CameraControls
    cameraControls = new CameraControls(camera, renderer.domElement);
    cameraControls.dollyToCursor = true;
    cameraControls.setLookAt(0, 0, -30, 0, 0, 0); // Početna pozicija i fokus

    loadAndCreatePlot();
    animate();
}

// Animacija sa CameraControls
function animate() {
    requestAnimationFrame(animate);

    const delta = clock.getDelta();
    cameraControls.update(delta); // Ažurira kontrole kamere

    renderer.render(scene, camera);
}

const clock = new THREE.Clock(); // Za CameraControls update

// Fetch podataka i učitavanje plot-a
function fetchData() {
    return fetch('http://127.0.0.1:5000/plot_data')
        .then(response => response.json())
        .catch(error => console.error("Error fetching plot data:", error));
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



function loadAndCreatePlot() {
    fetchData()
        .then(data => {
            console.log("Fetched data:", data);
            create2DPlot(data);
        })
        .catch(error => console.error("Error in loading or creating plot:", error));
}






let outlineMaterial = new THREE.MeshBasicMaterial({
    color: 0x0000, // Outline color (green)
    side: THREE.BackSide, // To create an outline effect
    opacity: 0.5, // Make outline semi-transparent
    transparent: true
});

// Kreiranje 2D plot-a
function create2DPlot(data) {
    console.log("create2DPlot data:", data);

    const minValue = Math.min(...data.y);
    const maxValue = Math.max(...data.y);
    console.log(maxValue);
    const geometry = new THREE.SphereGeometry(0.08, 32, 16); // Koristi istu veličinu loptica kao u prvom primeru
    points = [];
    const outlines = [];

    // Kreiramo tačke (spheres) na osnovu podataka
    for (let i = 0; i < data.x.length; i++) {
        let color = new THREE.Color(getColor(data.y[i], minValue, maxValue)); // Određivanje boje
        const material = new THREE.MeshBasicMaterial({ color });

        const sphere = new THREE.Mesh(geometry, material);

        // Skaliramo x i y vrednosti sa faktorom 10
        // Dodaj malu random varijaciju za razdvajanje tačaka
        sphere.position.set(data.x[i] * 10 + Math.random() * 0.5, data.y[i] * 5 - 20 + Math.random() * 0.5, 0);

        // Kreiraj outline
        const outlineSphere = new THREE.Mesh(geometry, outlineMaterial);
        outlineSphere.scale.set(1.2, 1.2, 1.2); // Povećaj outline za 20%

        // Dodaj outline na istu poziciju
        outlineSphere.position.copy(sphere.position);
        scene.add(outlineSphere);
        outlines.push(outlineSphere);

        // Dodaj originalnu loptu
        scene.add(sphere);
        points.push(sphere);

        // Dodaj geneName (ili drugi relevantni podaci) kao svojstvo na svakom objektu
        sphere.geneName = data.geneNames[i];
    }

    raycaster = new THREE.Raycaster();
    mouse = new THREE.Vector2();

    tooltip.appendChild(renderer.domElement);
}


function onMouseMove(event) {
    mousePointer = getMouseVector2(event, window);

    intersections = checkRayIntersections(mousePointer, camera, raycaster, scene, true); // Get first intersection
    const elementList = getSphereElements(intersections);

    // If no elements are hovered, hide the tooltip
    if (elementList.length === 0) {
        hideTooltip();
    } else {
        highlightSphereElements(elementList); // Show and highlight hovered elements
    }
}


function onClick(event) {
    // Prvo, izračunaj poziciju miša u normalizovanim koordinatama uređaja (-1 do 1)
    mousePointer = getMouseVector2(event, window);


    // Proveri da li postoji intersekcija između miša i objekata u sceni
    intersections = checkRayIntersections(mousePointer, camera, raycaster, scene, true);
    console.log("Inter in click:", intersections);
    // Ako postoji kliknut objekat, uzmi ga
    if (intersections !== []) {
        console.log("Mama draga");
        const clickedObject = intersections.object;
        console.log("Clicked object:", clickedObject);
        let geneName = clickedObject.geneName;  // Assuming geneName is inside metadata
        console.log(geneName); // Log geneName
        // Ako je kliknuta tačka, prikazuj podatke o gene-u ili bilo šta drugo što trebaš
        if (geneName) {
            fetchProteinConcentrationData(geneName)
                .then(proteinData => {
                    console.log(proteinData);
                    if (proteinData.young && proteinData.old) {
                        createProteinPLot(proteinData);
                        proteinPlot.setAttribute('style', 'display: block;');
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
            } // Ova funkcija može prikazivati podatke
        }
    }
}




function checkRayIntersections(mousePointer, camera, raycaster, scene, getFirstValue) {
    raycaster.setFromCamera(mousePointer, camera);

    // Get intersections in the scene
    let intersections = raycaster.intersectObjects(scene.children, true);

    // Log intersections
    // console.log('Intersections:', intersections);

    // Return only the first intersection if `getFirstValue` is true
    intersections = getFirstValue && intersections.length > 0 ? intersections[0] : intersections;

    return intersections || [];
}

// Function to calculate mouse position in normalized device coordinates (-1 to 1)
export function getMouseVector2(event, window){
    let mousePointer = new THREE.Vector2();

    mousePointer.x = (event.clientX / window.innerWidth) * 2 - 1;
    mousePointer.y = -(event.clientY / window.innerHeight) * 2 + 1;

    return mousePointer;
}

export function getSphereElements(objectList) {
    const meshElements = [];

    // Log the objectList to see what you are getting
    // console.log("objectList:", objectList);

    // If the objectList is not an array (i.e., a single object), check it directly
    if (!Array.isArray(objectList)) {
        if (objectList?.object) { // Ensure that 'object' exists
            meshElements.push(objectList.object); // Push the mesh object
        }
        return meshElements;
    }

    // Otherwise, loop through the objectList (which is an array)
    objectList.forEach((object) => {
        if (object && object.object) { // Ensure that 'object' and 'object.object' exist
            meshElements.push(object.object); // Push the mesh object
        } else {
            console.warn("Object or object.object is undefined:", object);
        }
    });

    return meshElements;
}

function highlightSphereElements(elementList) {
    // Reset previous highlights
    points.forEach((point) => {
        if (point.material) {
            point.material.transparent = true;
            point.material.opacity = 1.0;

            // Reset outline if it exists
            if (point.outline) {
                scene.remove(point.outline);
                point.outline = null;
            }
        }
    });

    elementList.forEach((element) => {
        if (element && element.material) {
            // Set reduced opacity for highlighting
            element.material.transparent = true;
            element.material.opacity = 0.5;

            // // Create outline effect
            // const outlineMaterial = new THREE.MeshBasicMaterial({
            //     color: 0xffffff, // White outline
            //     side: THREE.BackSide,
            // });
            //
            // const outlineMesh = new THREE.Mesh(element.geometry, outlineMaterial);
            // outlineMesh.scale.multiplyScalar(1.05); // Slightly enlarge outline
            // element.outline = outlineMesh;
            // scene.add(outlineMesh);

            // Show tooltip with geneName when hovering
            if (element.geneName) {
                const screenPosition = projectToScreen(element.position, camera);
                showTooltip(element.position.x, element.position.y, element.geneName, screenPosition.x, screenPosition.y);
            }
        }
    });
}




function projectToScreen(position, camera) {
    const vector = position.clone().project(camera);

    return {
        x: (vector.x + 1) * window.innerWidth / 2,
        y: (-vector.y + 1) * window.innerHeight / 2
    };
}

function showTooltip(x, y, geneName, screenX, screenY) {
    // Make sure the tooltip is visible only when hovered
    info.style.display = "block"; // Make the tooltip visible

    info.style.position = "absolute";
    info.style.left = `${screenX}px`;
    info.style.top = `${screenY}px`;
    info.style.backgroundColor = "rgba(0, 0, 0, 0.8)";
    info.style.color = "white";
    info.style.padding = "5px";
    info.style.borderRadius = "5px";
    info.style.fontSize = "12px";

    info.innerHTML = `
        <strong>Gene:</strong> ${geneName}<br>
        <strong>X:</strong> ${x.toFixed(2)}<br>
        <strong>Y:</strong> ${y.toFixed(2)}
    `;
}


function hideTooltip() {
    info.style.display = "none"; // Hide the tooltip when not hovering
}



function getColor(value, minValue, maxValue) {
    const colorsLow = ['rgba(82, 34, 88)', 'rgba(140, 48, 97)', 'rgba(198, 60, 81)', 'rgba(211, 144, 75)', 'rgba(217, 119, 89)'];
    const colorsHigh = ['rgba(217, 147, 89)', 'rgba(241,189,46)', 'rgba(241,213,135)'];

    const yMid = (minValue + maxValue) / 2;
    const rangeLow = yMid - minValue;
    const rangeHigh = maxValue - yMid;

    let normalizedValue;
    let colorIndex;

    if (value <= yMid) {
        normalizedValue = (value - minValue) / rangeLow;
        colorIndex = Math.floor(normalizedValue * 5);
        return colorsLow[colorIndex];
    } else {
        normalizedValue = (value - yMid) / rangeHigh;
        colorIndex = Math.floor(normalizedValue * (colorsHigh.length - 1));
        return colorsHigh[colorIndex];
    }
}

// Pokretanje aplikacije
window.addEventListener("DOMContentLoaded", () => {
    init();
});
