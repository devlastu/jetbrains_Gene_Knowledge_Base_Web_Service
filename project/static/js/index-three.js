import * as THREE from 'three';
import CameraControls from 'camera-controls';
import { MeshSurfaceSampler } from 'three/addons/math/MeshSurfaceSampler.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import Stats from 'three/addons/libs/stats.module.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

CameraControls.install({ THREE: THREE });
let rotationStep = 0.0001
let is3D = true; // Početno stanje je 3D
let isLoader = true
// Tooltip i osnovne promenljive
const tooltip = document.getElementById('myDiv');
const proteinPlot = document.getElementById('protein-plot');
const musicElement = document.getElementById('musicElement');
// Create the invisible element
let invisibleTargetElement;
let scene, camera, renderer, cameraControls, raycaster, mouse, points, mousePointer;
// Kreiraj novi tooltip element
const info = document.getElementById("elem-info");
// Omogućavanje CameraControls
const closeButton = document.getElementById("close-info");
let intersections = []
let selectedObject = null;
let originalColor = new THREE.Color();
const infoContainer = document.getElementById("sidebar-content");
const sidebar = document.getElementById("sidebar");
const scientificContainer = document.getElementById("scientific-paper");
let loadMoreBtn = document.getElementById("loadMoreBtn");
let resetBtn = document.getElementById("resetButton");
let plotData = JSON.parse(localStorage.getItem('plotData'));
const showMoreBtn = document.getElementById('moreImportantBtn');
const basicInfo = document.getElementById('important-genes');
let isRotating = true; // Flag koji kontroliše rotaciju
let sceneGroup; // Grupa koja sadrži sve objekte u sceni
const canvasLoader = document.querySelector('.loader');
const exploreBtn = document.getElementById("exploreBtn");
const loaderContainer = document.querySelector('.loader-container');
const resetMusicBtn = document.getElementById("resetMusic");
const toggleMusicBtn = document.getElementById("toggleMusic");
let music = document.getElementById("backgroundMusic");
const lavaLoader = document.getElementById("lava-loader");
const nonLoaderInfo = document.getElementById("non-loader");


let stemMesh, blossomMesh;
let stemGeometry, blossomGeometry;
let stemMaterial, blossomMaterial;
const dummy = new THREE.Object3D();

const _position = new THREE.Vector3();
const _normal = new THREE.Vector3();
const _scale = new THREE.Vector3();


window.onload = () => {
    canvasLoader.style.display = 'block';
}

// Global variable for initial camera and target positions
const initialCameraConfig = {
    position: new THREE.Vector3(0, 0, 150),
    target: new THREE.Vector3(0, 0, 0)
};

const loaderCameraConfig = {
    position: new THREE.Vector3(-10, -20, 50),
    target: new THREE.Vector3(0, 0, 0)
}

function toStartPosition() {
    cameraControls.setLookAt(
        loaderCameraConfig.position.x, loaderCameraConfig.position.y, loaderCameraConfig.position.z,
        loaderCameraConfig.target.x, loaderCameraConfig.target.y, loaderCameraConfig.target.z,
        true
    );
    rotationStep = 0.0001;
}



// Create an invisible object at the initial camera position
function createInvisibleTargetElement() {
    const geometry = new THREE.SphereGeometry(1); // Small sphere to act as the target (you can use any geometry)
    const material = new THREE.MeshBasicMaterial({ color: 0xffffff, opacity: 0, transparent: true }); // Invisible material
    const invisibleElement = new THREE.Mesh(geometry, material);

    // Set the position of the invisible element to match the initial camera position
    invisibleElement.position.copy(initialCameraConfig.position);

    // Add the invisible element to the scene (assuming you have a scene variable)
    scene.add(invisibleElement);

    return invisibleElement;
}


function resetCamera() {
    rotationStep = 0.001;
    zoomToElement(invisibleTargetElement, true)
    resetLook();
}

function resetLook(){
    cameraControls.setLookAt(
        initialCameraConfig.position.x, initialCameraConfig.position.y, initialCameraConfig.position.z,
        initialCameraConfig.target.x, initialCameraConfig.target.y, initialCameraConfig.target.z,
        true
    );
}

function toggleRotation() {
    isRotating = !isRotating;  // Okreni stanje rotacije
}


let hiddenObject = null
let torusObject = null
let apiCount = 1000
let sampler;
const ages = new Float32Array( apiCount );
const scales = new Float32Array( apiCount );
const modelDataDiv = document.getElementById("model-data");
const modelUrl = modelDataDiv.getAttribute("data-model-url");


const scaleCurve = function ( t ) {
    return Math.abs( easeOutCubic( ( t > 0.5 ? 1 - t : t ) * 2 ) );
};

const easeOutCubic = function ( t ) {
    return ( -- t ) * t * t + 1;
};


// Funkcija koja se poziva kada se klikne na loptu
function toggleSphereAndShowTorus(clickedObject) {

    const api = {
        count: apiCount,
        distribution: 'random',
        resample: resample,
        surfaceColor: clickedObject.material.color,
    };
    console.log(api);
    clickedObject.visible = false;
    hiddenObject = clickedObject;


    // let surfaceGeometry = new THREE.BoxGeometry( 10, 10, 10 ).toNonIndexed();
    const surfaceGeometry = new THREE.TorusKnotGeometry( 10, 3, 100, 16 ).toNonIndexed();
    torusObject = surfaceGeometry;
    const surfaceMaterial = new THREE.MeshLambertMaterial({
        color: api.surfaceColor,
        wireframe: false,
        transparent: false,  // Ensure transparency is off
        opacity: 1           // Set opacity to 1 for full visibilitys
    });
    const surface = new THREE.Mesh( surfaceGeometry, surfaceMaterial );




    // Scaling curve causes particles to grow quickly, ease gradually into full scale, then
    // disappear quickly. More of the particle's lifetime is spent around full scale.


    const loader = new GLTFLoader();

    loader.load( modelUrl, function ( gltf ) {
        const _stemMesh = gltf.scene.getObjectByName( 'Stem' );
        const _blossomMesh = gltf.scene.getObjectByName( 'Blossom' );

        stemGeometry = _stemMesh.geometry.clone();
        blossomGeometry = _blossomMesh.geometry.clone();

        const defaultTransform = new THREE.Matrix4()
            .makeRotationX( Math.PI )
            .multiply( new THREE.Matrix4().makeScale( 7, 7, 7 ) );

        stemGeometry.applyMatrix4( defaultTransform );
        blossomGeometry.applyMatrix4( defaultTransform );

        stemMaterial = _stemMesh.material;
        blossomMaterial = _blossomMesh.material;

        stemMesh = new THREE.InstancedMesh( stemGeometry, stemMaterial, apiCount );
        blossomMesh = new THREE.InstancedMesh( blossomGeometry, blossomMaterial, apiCount );

        // Assign random colors to the blossoms.
        const color = new THREE.Color();
        const blossomPalette = [ 0xF20587, 0xF2D479, 0xF2C879, 0xF2B077, 0xF24405 ];

        for ( let i = 0; i < apiCount; i ++ ) {
            color.setHex( blossomPalette[ Math.floor( Math.random() * blossomPalette.length ) ] );
            blossomMesh.setColorAt( i, color );
        }

        // Instance matrices will be updated every frame.
        stemMesh.instanceMatrix.setUsage( THREE.DynamicDrawUsage );
        blossomMesh.instanceMatrix.setUsage( THREE.DynamicDrawUsage );

        resample();
        initialize();
    } );

    function initialize() {
        camera = new THREE.PerspectiveCamera( 60, window.innerWidth / window.innerHeight, 0.1, 100 );
        camera.position.set( 25, 25, 25 );
        camera.lookAt( 0, 0, 0 );


        const pointLight = new THREE.PointLight( 0xAA8899, 2.5, 0, 0 );
        pointLight.position.set( 50, - 25, 75 );
        scene.add( pointLight );

        scene.add( new THREE.AmbientLight( 0xffffff, 3 ) );

        scene.add( stemMesh );
        scene.add( blossomMesh );
        scene.add( surface );

    }

    function resample() {
        const vertexCount = surface.geometry.getAttribute( 'position' ).count;
        console.info( 'Sampling ' + apiCount + ' points from a surface with ' + vertexCount + ' vertices...' );
        console.time( '.build()' );
        sampler = new MeshSurfaceSampler( surface )
            .setWeightAttribute( api.distribution === 'weighted' ? 'uv' : null )
            .build();
        console.timeEnd( '.build()' );
        console.time( '.sample()' );
        for ( let i = 0; i < apiCount; i ++ ) {
            ages[ i ] = Math.random();
            scales[ i ] = scaleCurve( ages[ i ] );
            resampleParticle( i );
        }
        console.timeEnd( '.sample()' );
        stemMesh.instanceMatrix.needsUpdate = true;
        blossomMesh.instanceMatrix.needsUpdate = true;
    }
}

function updateParticle( i ) {
    ages[ i ] += 0.005;
    if ( ages[ i ] >= 1 ) {
        ages[ i ] = 0.001;
        scales[ i ] = scaleCurve( ages[ i ] );
        resampleParticle( i );
        return;
    }
    const prevScale = scales[ i ];
    scales[ i ] = scaleCurve( ages[ i ] );
    _scale.set( scales[ i ] / prevScale, scales[ i ] / prevScale, scales[ i ] / prevScale );
    stemMesh.getMatrixAt( i, dummy.matrix );
    dummy.matrix.scale( _scale );
    stemMesh.setMatrixAt( i, dummy.matrix );
    blossomMesh.setMatrixAt( i, dummy.matrix );
}
function resampleParticle( i ) {
    sampler.sample( _position, _normal );
    _normal.add( _position );
    dummy.position.copy( _position );
    dummy.scale.set( scales[ i ], scales[ i ], scales[ i ] );
    dummy.lookAt( _normal );
    dummy.updateMatrix();
    stemMesh.setMatrixAt( i, dummy.matrix );
    blossomMesh.setMatrixAt( i, dummy.matrix );
}

function init() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000);


    renderer = new THREE.WebGLRenderer();
    renderer.setSize(window.innerWidth, window.innerHeight);
    tooltip.appendChild(renderer.domElement);



    // Initialize the camera with the initial position
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.copy(initialCameraConfig.position);
    resetBtn.addEventListener("click", closeFunction);

    // console.log("Scene and camera initialized:", scene, camera); // Check initialization

    // Inicijalizacija CameraControls
    cameraControls = new CameraControls(camera, renderer.domElement);
    cameraControls.dollyToCursor = true;

    // Use the global variable to set the initial look-at configuration
    cameraControls.setLookAt(
        initialCameraConfig.position.x, initialCameraConfig.position.y, initialCameraConfig.position.z,
        initialCameraConfig.target.x, initialCameraConfig.target.y, initialCameraConfig.target.z
    );
    window.addEventListener( 'resize', onWindowResize );
    loadAndCreatePlot();
    invisibleTargetElement = createInvisibleTargetElement()
    animate();

    // Dodavanje event listenera za dugme "More" i "Less"
    showMoreBtn.addEventListener('click', toggleMoreLess);
    // Pozovi funkciju sa listom gena iz localStorage
    if (plotData && plotData.important) {
        displayImportantGenes(plotData.important, 0, 7);
    } else {
        console.error("Nema podataka za gene u localStorage.");
    }
}

function render() {
    if ( stemMesh && blossomMesh ) {

        const time = Date.now() * 0.001;

        scene.rotation.x = Math.sin( time / 4 );
        scene.rotation.y = Math.sin( time / 2 );

        for ( let i = 0; i < apiCount; i ++ ) {

            updateParticle( i );

        }

        stemMesh.instanceMatrix.needsUpdate = true;
        blossomMesh.instanceMatrix.needsUpdate = true;

        stemMesh.computeBoundingSphere();
        blossomMesh.computeBoundingSphere();

    }

    renderer.render( scene, camera );
}
// Animacija sa CameraControls
function animate() {
    requestAnimationFrame(animate);

      // Ako je rotacija omogućena, rotiraj scenu
    if (isRotating) {
        // console.log("Rotating...");
        if (is3D) {
            scene.rotation.y += rotationStep; // Brzina rotacije
        }
    }
    const delta = clock.getDelta();
    cameraControls.update(delta); // Ažurira kontrole kamere

    render()

}

const clock = new THREE.Clock(); // Za CameraControls update

// Fetch podataka i učitavanje plot-a
function fetchData() {
    return fetch('http://127.0.0.1:5000/plot_data')
        .then(response => response.json())
        .then(data => {
            // Sačuvaj podatke u local storage
            localStorage.setItem('plotData', JSON.stringify(data));
            // console.log("Podaci su sačuvani u local storage.");
            return data; // Vrati podatke za dalju obradu
        })
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
                expressionInfo: data.expressionInfo
            };
            })
        .catch(error => {
            console.error('Error fetching protein concentration data:', error);
            throw error;
        });
}


function handleGeneSelection(clickedObject) {

    isRotating = false;
    // console.log("Ovdje ga na false");
    lavaLoader.style.display = 'block';
    basicInfo.setAttribute('style', 'display:none');
    // Vraćanje boje originalnog objekta
    restoreOriginalColor();

    // Odabir trenutnog objekta
    selectedObject = clickedObject;
    originalColor.copy(selectedObject.material.color);

    // Osvetljavanje selektovanog objekta
    lightenColor(selectedObject.material);

    // Smanjivanje drugih objekata na sceni
    dimOtherElements(scene, clickedObject);

    // Zoom u selektovani objekat
    zoomToElement(clickedObject, true);

    // Učitavanje podataka o proteinu
    let geneName = clickedObject.geneName;
    if (geneName) {
        fetchProteinConcentrationData(geneName)
            .then(proteinData => {
                if (proteinData.young && proteinData.old) {
                    // Učitavanje naučnih radova i kreiranje grafikona
                    loadGenePapers(geneName);
                    createProteinPLot(proteinData);
                    proteinPlot.setAttribute('style', 'display: block;');

                    // Popunjavanje podataka u odgovarajući interfejs
                    fillInData(proteinData);

                    // Prikazivanje dugmeta za zatvaranje
                    closeButton.classList.add("visible");
                } else {
                    console.error("Error: Missing data for plotting.");
                }
            })
            .catch(error => console.error("Error fetching protein concentration data:", error));
    }
}


function displayImportantGenes(genes, start, end) {
    const genesListContainer = document.getElementById('genes-list');
    genesListContainer.innerHTML = '';  // Očisti prethodni sadržaj
    const slice = genes.slice(start, end);
    // Iteriraj kroz listu gena
    slice.forEach(gene => {

        // Provera da li su vrednosti definisane i da li su brojevi
        const logFC = (typeof gene.logFC === 'number' && !isNaN(gene.logFC)) ? gene.logFC.toFixed(2) : 'N/A';
        const adjPVal = (typeof gene['adj.P.Val'] === 'number' && !isNaN(gene['adj.P.Val'])) ? gene['adj.P.Val'].toFixed(2) : 'N/A';

        // Kreiraj div za svaki gen
        const geneDiv = document.createElement('div');
        geneDiv.classList.add('gene-item');

        // Kreiraj div za geneSymbol
        const geneSymbolDiv = document.createElement('div');
        geneSymbolDiv.classList.add('gene-symbol');
        geneSymbolDiv.textContent = gene.geneSymbol;

        // Kreiraj div za logFC
        const logFCDiv = document.createElement('div');
        logFCDiv.classList.add('logFC');
        logFCDiv.textContent = logFC;
        // Dodaj crvenu boju ako je logFC manji od 0, zelenu ako je veći od 0
        if (parseFloat(logFC) < 0) {
            logFCDiv.style.color = '#ae1c1c';
        } else if (parseFloat(logFC) > 0) {
            logFCDiv.style.color = '#5f983f';
        }

        // Kreiraj div za adj.P.Val
        const adjPValDiv = document.createElement('div');
        adjPValDiv.classList.add('adjPVal');
        adjPValDiv.textContent = adjPVal;

        // Dodaj crvenu boju ako je adj.P.Val manji od 0, zelenu ako je veći od 0
        if (parseFloat(adjPVal) < 0) {
            adjPValDiv.style.color = '#ae1c1c';
        } else if (parseFloat(adjPVal) > 0) {
            adjPValDiv.style.color = '#5f983f';
        }

        // Dodaj sve divove u geneDiv
        geneDiv.appendChild(geneSymbolDiv);
        geneDiv.appendChild(logFCDiv);
        geneDiv.appendChild(adjPValDiv);


        // Dodaj event listener za klik
        geneDiv.addEventListener('click', function(event) {
            const geneSymbol = gene.geneSymbol; // Dobijamo simbol gena koji je kliknut
            isRotating = false;
            const geneData = localStorage.getItem(geneSymbol); // Preuzimamo podatke iz localStorage

            if (!geneData) {
                console.error(`Gen ${geneSymbol} nije pronađen u localStorage.`);
                return;
            }

            const geneInfo = JSON.parse(geneData); // Parsiramo JSON string iz localStorage
            const { x, y, z } = geneInfo.position; // Ekstraktujemo poziciju gena

            console.log(`Gen ${geneSymbol} pozicija:`, x, y, z);

            // Pronađi 3D objekat u sceni (pretpostavljamo da postoji neka funkcija get3DObjectByPosition)
            const targetElement = get3DObjectByPosition(x, y, z);

            handleGeneSelection(targetElement);
        });

        // Dodaj geneDiv u container
        genesListContainer.appendChild(geneDiv);
    });
}

// Funkcija za traženje 3D objekta na osnovu pozicije
function get3DObjectByPosition(x, y, z) {
    let closestObject = null;
    let minDistance = Infinity;

    scene.traverse((object) => {
        if (object.isMesh) {
            const objPos = object.position;
            const distance = Math.sqrt(
                Math.pow(objPos.x - x, 2) +
                Math.pow(objPos.y - y, 2) +
                Math.pow(objPos.z - z, 2)
            );

            if (distance < minDistance) {
                minDistance = distance;
                closestObject = object;
            }
        }
    });

    return closestObject;
}


function onGeneSelection(geneName) {
  // Pronalaženje podataka o genu u localStorage
  const geneData = JSON.parse(localStorage.getItem(geneName));

  if (geneData) {
    // Pronađi odgovarajući objekat u listi 'points' koristeći geneName
    let selectedObject = null;
    for (let i = 0; i < points.length; i++) {
      if (points[i].geneName === geneName) {
        selectedObject = points[i];
        break;
      }
    }

    if (selectedObject) {
      // Ako je objekat pronađen, nastavite sa obradom
      restoreOriginalColor();
      originalColor.copy(selectedObject.material.color);

      lightenColor(selectedObject.material);
      dimOtherElements(scene, selectedObject);
      zoomToElement(selectedObject, true);

      // Korišćenje podataka o genu (ako je potrebno)
      console.log("Gene data:", geneData);
      // Na primer, možete koristiti geneData za dalju obradu, kao što je pozivanje funkcije za dodatne podatke
      fetchProteinConcentrationData(geneData.geneName)
        .then(proteinData => {
          if (proteinData.young && proteinData.old) {
            loadGenePapers(geneData.geneName);
            createProteinPlot(proteinData);
            proteinPlot.setAttribute('style', 'display: block;');
            fillInData(proteinData);
            closeButton.classList.add("visible");
          } else {
            console.error("Error: Missing data for plotting.");
          }
        })
        .catch(error => console.error("Error fetching protein concentration data:", error));
    } else {
      console.error("Gene object not found in the list.");
    }
  } else {
    console.error("Gene data not found in localStorage.");
  }
}

function fillInData(proteinData) {

    if (proteinData && proteinData.additionalInfo) {
        const additionalInfo = proteinData.additionalInfo;
        let geneData = getGeneData(additionalInfo.EntrezGeneSymbol)

        infoContainer.innerHTML = `  
            <h2>🧬 Gene: ${additionalInfo.EntrezGeneSymbol}</h2>
            <p><strong>Full Name:</strong> ${additionalInfo.TargetFullName}</p>
            <p><strong>Target:</strong> ${additionalInfo.Target}</p>
            <p><strong>Gene ID:</strong> ${additionalInfo.EntrezGeneID}</p>
            <p><strong>Organism:</strong> ${additionalInfo.Organism}</p>
            
            <hr>  
            
            <h3>📊 Protein Concentration Data</h3>
            <p><strong>Units:</strong> ${additionalInfo.Units}</p>
            <p><strong>Type:</strong> ${additionalInfo.Type}</p>
            <p><strong>Dilution:</strong> ${additionalInfo.Dilution}</p>
            
            <hr>
            <p><strong>logFC:</strong> ${geneData.logFC.toFixed(2)}</p>
            <p><strong>adj_P_Val:</strong> ${geneData.adj_P_Val.toFixed(2)}</p>
            
            
        `;
        } else {
            console.error("Protein data is missing or malformed.");
        }
}

// Funkcija koja vraća indeks gena u listi
function findGeneIndex(geneSymbol) {
    return genes.findIndex(gene => gene.geneSymbol === geneSymbol);
}



// Funkcija koja upravlja dugmetom "More" i "Less"
function toggleMoreLess() {

    const showMoreBtn = document.getElementById('moreImportantBtn');
    const genesListContainer = document.getElementById('genes-list');
    const data = JSON.parse(localStorage.getItem('plotData'));  // Pretpostavljam da imate gene u localStorage
    const genes = data['important'];


    let start = 0;
    let end = 7;

    // Ako je trenutno prikazano "more indices", povećaj broj prikazanih gena
    if (showMoreBtn.textContent === 'more indices') {
        end = end + 7;
        if (end > genes.length) {
            end = genes.length;  // Kada nema više gena, prikaži sve
            showMoreBtn.textContent = 'less indices';
        }
    } else {
        // Ako je već kliknuto "less indices", prikaži prvih 7
        start = 0;
        end = 7;
        showMoreBtn.textContent = 'more indices';  // Ponovo prikaži prvih 7
    }

    // Prikazivanje gena
    displayImportantGenes(genes, start, end);
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
        name: 'Young',
        hovertemplate: 'Young<br>X: %{x}<br>Y: %{y}<extra></extra>',
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
        name: 'Old',
        hovertemplate: 'Old<br>X: %{x}<br>Y: %{y}<extra></extra>',
        type: 'scatter'
    };

    // Dobijanje širine sidebar-a i postavljanje visine na željenu vrednost (30%)
    const sidebarWidth = document.getElementById('sidebar').offsetWidth; // Širina sidebar-a
    const plotHeight = window.innerHeight * 0.3; // Visina 30% od visine prozora


    // Layout za plot
    const layout = {
        width: 0.9 * sidebarWidth,  // Koristi širinu sidebar-a
        height: plotHeight,   // Koristi visinu 30% od prozora
        margin: { l: 0, r: 0, b: 0, t: 0 },  // Ukoni margine za da bi bilo što je moguće bliže ivici
        paper_bgcolor: "#000000",  // Pozadina papira
        plot_bgcolor: "#000000",   // Pozadina grafa
        font: { color: "#ffffff" }, // Tekst u beloj boji
        showlegend: false, // Sakrij legendu
        hovermode: 'closest',
        xaxis: {
            showgrid: true,  // Prikazivanje mreže na x-osi
            zeroline: false, // Sakrij nulu na x-osi
            showticklabels: true, // Prikazivanje oznaka na x-osi
            color: '#ffffff', // Boja osa
        },
        yaxis: {
            showgrid: true,  // Prikazivanje mreže na y-osi
            zeroline: false, // Sakrij nulu na y-osi
            showticklabels: true, // Prikazivanje oznaka na y-osi
            color: '#ffffff', // Boja osa
        }
    };


    // Kreiraj plot u #protein-plot div-u
    Plotly.newPlot('protein-plot', [traceYoung, traceOld], layout);
}



let allPapers = [];
let visiblePapers = 3; // Početno prikazivanje 3 rada
function handleLoadMoreClick() {
    console.log("clicked")
    console.log(loadMoreBtn.innerText)
    if (loadMoreBtn.innerText === "SHOW MORE") {
        console.log("show more")
        visiblePapers = allPapers.length; // Učitaj sve radove
        console.log(visiblePapers);
    } else {
        visiblePapers = 3; // Resetuj na 3 rada
    }
    displayPapers(); // Ponovo prikaži radove
}

loadMoreBtn.addEventListener("click", handleLoadMoreClick);

// Funkcija za prikaz radova
function displayPapers() {
    console.log("display papers");
    scientificContainer.innerHTML = "Scientific papers related to gene:"; // Očisti prethodni sadržaj
    const list = document.createElement("ul");
    for (let i = 0; i < Math.min(visiblePapers, allPapers.length); i++) {
        const item = document.createElement("li");
        item.innerHTML = `<a href="${allPapers[i]}" target="_blank" class="custom-link">PubMed link: ${allPapers[i]}</a>`;
        list.appendChild(item);
    }


    scientificContainer.appendChild(list);

    // Dodaj Show More dugme ako je potrebno
    if (visiblePapers < allPapers.length) {
        loadMoreBtn.style.display = "block";
        loadMoreBtn.innerText = "Show More";
    } else {
        loadMoreBtn.style.display = "block";
        loadMoreBtn.innerText = "Show Less";
    }

    // Omogućiti skrolovanje unutar scientific-paper div-a
    scientificContainer.style.maxHeight = "300px";
    scientificContainer.style.overflowY = "auto";
}


function loadGenePapers(geneName) {
    // Provera da li elementi postoje

    if (!scientificContainer) {
        console.error("Error: Element #scientific-paper not found.");
        return;
    }

    // Kreiraj "Show More" dugme ako ne postoji

    if (!loadMoreBtn) {
        loadMoreBtn = document.createElement("button");
        loadMoreBtn.id = "loadMoreBtn";
        loadMoreBtn.innerText = "Show More";
        loadMoreBtn.style.marginTop = "10px";
        scientificContainer.after(loadMoreBtn);
    }

    // Fetch podaci sa servera
    fetch(`/get_gene_papers?gene_name=${geneName}`)
        .then(response => response.json())
        .then(data => {
            console.log(data);
            if (data.pubmed_papers && data.pubmed_papers.length > 0) {
                allPapers = data.pubmed_papers;
                // console.log(allPapers);

                setTimeout(() => {

                    lavaLoader.style.display = "none"; // Sakrij lava-lamp
                    // nonLoaderInfo.style.display = "block";
                    nonLoaderInfo.style.opacity = "1";
                    nonLoaderInfo.style.transform = "scale(1)"; // Postavlja ga na normalnu veličinu
                }, 1000); // 3 sekunde trajanje

                visiblePapers = 3; // Resetuj početni broj prikazanih radova
                if(selectedObject)displayPapers();
            } else {
                sidebarContent.innerHTML = "<p>No related papers found.</p>";
            }
        })
        .catch(error => console.error("Error fetching data:", error));
}



function loadAndCreatePlot() {
    fetchData()
        .then(data => {
            if(is3D){
                isRotating = true
                create3DPlot(data);  // Kreiraj plot koristeći podatke
            }else{
                isRotating = false;
                scene.rotation.y = 0
                create2DPlot(data);
            }

            // simulateClickOnCenter();
        })
        .catch(error => {
            console.error("Error in loading or creating plot:", error);
        });
}



function lightenColor(material, factor = 0.2) {
    const color = new THREE.Color(material.color);
    color.offsetHSL(0, 0, factor); // Povećava svetlinu
    material.color.set(color);
}

function restoreOriginalColor() {
    if (selectedObject) {
        selectedObject.material.color.set(originalColor); // Vrati staru boju
        selectedObject = null;
    }
}

function dimOtherElements(scene, selectedObject, dimOpacity = 0.3, originalOpacity = 1) {
    scene.traverse((object) => {
        if (object.isMesh && object.material) {
            if (object === selectedObject) {
                object.material.opacity = originalOpacity; // Ostavlja kliknuti objekat nepromenjen
            } else {
                object.material.opacity = dimOpacity; // Smanjuje opacity za sve ostale
            }
        }
    });
}

function restoreAllColors(){
    // Vratiti originalnu boju selektovanog objekta, ako postoji
    if (selectedObject) {
        selectedObject.material.color.set(originalColor); // Vraćanje originalne boje
        selectedObject.material.opacity = 1; // Vraćanje opaciteta na originalno (1)
        selectedObject = null; // Resetuj selektovani objekat
    }

    // Vratiti sve objekte u sceni u njihovo originalno stanje (boje i opaciteti)
    scene.traverse((object) => {
        if (object.isMesh && object.material) {
            // Vratiti boju na originalnu
            if (object.material.hasOwnProperty('originalColor')) {
                object.material.color.set(object.material.originalColor); // Vrati originalnu boju objekta
            }

            // Vratiti opacitet na originalnu vrednost
            if (object.material.hasOwnProperty('originalOpacity')) {
                object.material.opacity = object.material.originalOpacity; // Vrati originalni opacitet
            } else {
                object.material.opacity = 1; // Ako nije postavljen originalni opacitet, postavi na 1
            }
        }
    });
}



let axesHelper;
// Kreiranje 2D plot-a
function create2DPlot(data) {
    console.log("create2DPlot data:", data);
    clearScene();
    resetTooltip();

    if (isLoader){
        toStartPosition();
    }else{
        resetCamera();
    }

    //  // Dodaj koordinatne ose na početku (po potrebi)
    // if (!axesHelper) {
    //     axesHelper = new THREE.AxesHelper(50);  // 50 je dužina osa
    //
    //     // Rotiraj ose za 90 stepeni oko Y ose
    //     axesHelper.rotation.set(0, Math.PI / 2, 0); // Rotacija za 90 stepeni oko Y ose
    //
    //     // Postavi ose na određenu poziciju ako je potrebno
    //     axesHelper.position.set(0, -60, 0);  // Pozicija koordinatnih osa (x=0, y=0, z=0)
    //
    //     scene.add(axesHelper);
    // }


    const minValue = Math.min(...data.y);
    const maxValue = Math.max(...data.y);
    console.log(maxValue);
    const geometry = new THREE.SphereGeometry(0.2, 32, 16); // Koristi istu veličinu loptica kao u prvom primeru
    points = [];
    const outlines = [];

    // Kreiramo tačke (spheres) na osnovu podataka
    for (let i = 0; i < data.x.length; i++) {
        let color = new THREE.Color(getColor(data.y[i], minValue, maxValue)); // Određivanje boje
        const material = new THREE.MeshStandardMaterial({
          color,
          emissive: color,  // Dodaj svetleći efekat u istoj boji
          emissiveIntensity: 2, // Povećaj ako želiš jači sjaj
          transparent: true,
          opacity: 1,
        });

        const sphere = new THREE.Mesh(geometry, material);

        // Skaliramo x i y vrednosti sa faktorom 10
        // Dodaj malu random varijaciju za razdvajanje tačaka
        sphere.position.set(data.x[i] * 50 + Math.random() * 0.5, data.y[i] * 20 - 60 + Math.random() * 0.5, 0);

        // // Kreiraj outline
        // const outlineSphere = new THREE.Mesh(geometry, outlineMaterial);
        // outlineSphere.scale.set(1.2, 1.2, 1.2); // Povećaj outline za 20%
        //
        // // Dodaj outline na istu poziciju
        // outlineSphere.position.copy(sphere.position);
        // scene.add(outlineSphere);
        // outlines.push(outlineSphere);

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

// Helper function to toggle the grid
function toggleAxis() {
    if (gridHelper) {
        if (scene.children.includes(gridHelper)) {
            scene.remove(gridHelper);  // Ukloni mrežu
        } else {
            scene.add(gridHelper);  // Dodaj mrežu
        }
    }
}

function clearScene() {
    while (scene.children.length > 0) {
        scene.remove(scene.children[0]);
    }
    points = [];
}

function resetTooltip() {
    const tooltip = document.getElementById("tooltip");
    if (tooltip) {
        tooltip.innerHTML = `
            <div id="myDiv">
                <button id="toggleButton">2D</button>
                <button id="resetButton">Reset to Initial Position</button>
                <div id="elem-info"></div>
                <div id="sidebar">
                    <h2>Information</h2>
                    <div id="protein-plot"></div>
                    <div id="scientific-paper"></div>
                    <button id="loadMoreBtn"></button>
                    <div id="sidebar-content"></div>
<!--                    <button id="closeSidebar">Close</button>-->
                </div>
            </div>
        `;
    }
}



function create3DPlot(data) {
  // console.log("create3DPlot data:", data);

  clearScene();
  resetTooltip();
  if (isLoader){
      toStartPosition();
  }else{
      resetCamera();
      resetCamera()
  }


  const minValue = Math.min(...data.y);
  const maxValue = Math.max(...data.y);
  console.log(maxValue);

  points = [];

  // Loop through the data and create spheres for the plot
  for (let i = 0; i < data.x.length; i++) {
    let color = new THREE.Color(getColor(data.y[i], minValue, maxValue));
    let scaleFactor = getScaledSize(data.y[i], minValue, maxValue);
    // Create geometry for the sphere directly without calling createBubble
    let geometry = new THREE.SphereGeometry(scaleFactor, 64, 32);

    const material = new THREE.MeshStandardMaterial({
      color,
      emissive: color,  // Dodaj svetleći efekat u istoj boji
      emissiveIntensity: 2, // Povećaj ako želiš jači sjaj
      transparent: true,
      opacity: 1,
    });

    const sphere = new THREE.Mesh(geometry, material);

    sphere.position.set(
      data.x[i] * 50 + Math.random() * 2,
      data.y[i] * 12 - 40,
      Math.random() * 70
    );

    scene.add(sphere);
    points.push(sphere);


    // Store the gene name and coordinates in localStorage
    const geneData = {
      geneName: data.geneNames[i],
      position: {
        x: sphere.position.x,
        y: sphere.position.y,
        z: sphere.position.z,
      },
      scale: scaleFactor,
    };

    // Add the gene data to localStorage (using gene name as the key)
    localStorage.setItem(data.geneNames[i], JSON.stringify(geneData));
    // Store the gene name on the sphere object
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
    // console.log(elementList);

    // If no elements are hovered, hide the tooltip
    if (elementList.length === 0) {
        hideTooltip();
    } else {
        highlightSphereElements(elementList); // Show and highlight hovered elements
    }
}

// Funkcija koja vraća sve u prethodno stanje
function emptySidebar() {
    // Vratiti originalnu boju prethodno selektovanog objekta
    if (selectedObject) {
        restoreOriginalColor(); // Vrati boju selektovanog objekta
        selectedObject = null; // Resetuj selektovani objekat
    }

    // Sakrij sidebar sadržaj
    infoContainer.innerHTML = ""; // Očisti informacije o genu

    // Sakrij protein plot
    proteinPlot.setAttribute('style', 'display: none;'); // Sakrij plot

    //Sakrij papers
    scientificContainer.innerHTML = '';

    loadMoreBtn.setAttribute('style', 'display: none;');


    // Sakrij dugme za zatvaranje
    closeButton.classList.remove("visible");

    console.log("All changes have been restored to their original state.");
}


let lastClickTime = 0;
let mouseDownPos = { x: 0, y: 0 };
let isDragging = false;

// Detektujemo kada korisnik pritisne dugme miša
window.addEventListener("mousedown", (event) => {
    mouseDownPos = { x: event.clientX, y: event.clientY };
    isDragging = false;
});

// Detektujemo kretanje miša da prepoznamo drag
window.addEventListener("mousemove", (event) => {
    const moveX = Math.abs(event.clientX - mouseDownPos.x);
    const moveY = Math.abs(event.clientY - mouseDownPos.y);

    if (moveX > 5 || moveY > 5) {
        isDragging = true; // Ako je pomeraj veći od 5px, tretiramo ga kao drag
    }
});

// Kada korisnik otpusti miš
function onClick(event) {

    if (isDragging) return; // Ako je bio drag, ignoriši klik

    const currentTime = new Date().getTime();
    const clickInterval = currentTime - lastClickTime;
    lastClickTime = currentTime;

    mousePointer = getMouseVector2(event, window);
    intersections = checkRayIntersections(mousePointer, camera, raycaster, scene, true);

    if (intersections.object) {

        const clickedObject = intersections.object;
        console.log(clickedObject);
        handleGeneSelection(clickedObject);
        // toggleSphereAndShowTorus(clickedObject);
    } else {
        if (clickInterval < 300) {
            closeFunction();
        }

    }

}


function restoreSphereAndRemoveTorus(clickedObject, torus) {
    // After 3 seconds, show the sphere again and remove the torus
    clickedObject.visible = true; // Make the clicked object (sphere) visible again
    scene.remove(torus); // Remove the torus from the scene
    torusObject = null;
    hiddenObject = null;
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


function zoomToElement(targetElement, enableTransition) {
    if (!targetElement) return;
    // Check if the target element has a bounding box
    const boundingBox = new THREE.Box3().setFromObject(targetElement);

    // Use the cameraControls.fitToBox method to zoom to the target element
    cameraControls.fitToBox(boundingBox, enableTransition, {
        cover: false, // Set to false to prevent the camera from fully filling the screen with the element
        paddingTop: 2, // Optional: Add a little padding to the top
        paddingLeft: 2, // Optional: Add a little padding to the left
        paddingBottom:2, // Optional: Add a little padding to the bottom
        paddingRight: 2 // Optional: Add a little padding to the right
    }).then(() => {
        console.log("Zoom to element completed!");
    }).catch((error) => {
        console.error("Error in zoomToElement:", error);
    });
}

function getGeneData(geneName) {

  if (!plotData) {
    plotData = JSON.parse(localStorage.getItem("plotData"));
  }

  // Pronađi indeks gde se nalazi traženi gen
  const geneIndex = plotData.geneNames.indexOf(geneName);
  if (geneIndex === -1) {
    console.error(`Gene ${geneName} not found in plot_data`);
    return null;
  }


  // Izvuci tražene podatke
  return {
    geneName: geneName,
    logFC: plotData.x[geneIndex],
    adj_P_Val: plotData.y[geneIndex]
  };
}




function highlightSphereElements(selectedElement) {

    // Ensure selectedElement is valid
    // console.log(selectedElement[0]);
    selectedElement = selectedElement[0];
    // console.log(selectedElement);
    if (selectedElement) {
        // Show tooltip
        if (selectedElement.geneName) {
            const screenPosition = projectToScreen(selectedElement.position, camera);
            let geneData = getGeneData(selectedElement.geneName);
            // console.log(geneData);
            showTooltip(
                geneData.logFC,
                geneData.adj_P_Val,
                selectedElement.geneName,
                screenPosition.x,
                screenPosition.y
            );
        }

    } else {
        console.warn("Selected element is not a valid THREE.Mesh object.");
    }
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
        <strong>LogFC:</strong> ${x.toFixed(2)}<br>
        <strong>ajd_P_Val:</strong> ${y.toFixed(2)}
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

function getScaledSize(value, minValue, maxValue) {
    const midThreshold = minValue + (maxValue - minValue) * 0.5; // 80% tačke vrednosti

    if (value <= midThreshold) {
        // Prvih 80% ide od 0.08 do 0.8
        return 0.08 + ((value - minValue) / (midThreshold - minValue)) * (1.5 - 0.08);
    } else {
        // Preostalih 20% ide od 0.8 do 3, ali ako pređe 20, postavi ga na 20
        const size = 0.8 + ((value - midThreshold) / (maxValue - midThreshold)) * (12 - 0.8);
        return Math.min(size, 20); // Ova linija postavlja maksimalnu veličinu na 20
    }
}

function onWindowResize() {

    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();

    renderer.setSize( window.innerWidth, window.innerHeight );

}

function closeFunction() {
    closeButton.classList.remove("visible");
    if(torusObject) {
        restoreSphereAndRemoveTorus(hiddenObject, torusObject);
    }
    basicInfo.style.display = "block";
    nonLoaderInfo.style.opacity = "0";
    nonLoaderInfo.style.transform = "scale(0.95)";
    emptySidebar()
    resetTooltip();
    resetCamera();
    restoreAllColors();
    isRotating = true;
}



// Pokretanje aplikacije
window.addEventListener("DOMContentLoaded", () => {

    init();

    document.getElementById("myDiv").classList.add("fadeIn");
    setTimeout(function() {
        canvasLoader.style.display = "none";
        tooltip.style.display = "block";
        exploreBtn.style.display = "block";

    }, 2000);


    selectedObject = null
    // Kada klikneš na close dugme, sakrij ga
    closeButton.addEventListener("click", closeFunction);
    const toggleButton = document.getElementById("toggleButton");
    toggleButton.textContent = "2D"; // Dugme počinje s natpisom '2D'
    const testPageButton = document.getElementById("testButton");

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

    // Dodajemo event listener za dugme
    testPageButton.addEventListener('click', function() {
        window.location.href =  '/test-page'; // Pozivamo Flask rutu koja vodi do test.html
    });

    exploreBtn.addEventListener("click", function () {
        loaderContainer.style.display = "none";
        sidebar.style.display = "block";
        resetBtn.style.display = "block";
        toggleButton.style.display = "block";
        musicElement.style.display = "block";

         // Add listener to call onMouseMove every time the mouse moves in the browser window
        document.addEventListener('mousemove', onMouseMove, false);
        document.addEventListener('click', onClick, false); // Dodajemo event listener za click




        music.play();
        isLoader = false
        resetCamera();
    })

    resetMusicBtn.addEventListener("click", function () {
        resetMusic()
    })
    toggleMusicBtn.addEventListener("click", function () {
        toggleMusic();
    })
});



function toggleMusic() {
    let music = document.getElementById("backgroundMusic");
    let play = document.getElementById("playIcon");
    let pause = document.getElementById("pauseIcon");
    if (music.paused) {
        music.play();
        play.style.display = "none";
        pause.style.display = "block";
    } else {
        play.style.display = "block";
        pause.style.display = "none";
        music.pause();
    }
}

function resetMusic() {

    music.pause(); // Pauziraj muziku
    music.currentTime = 0; // Vrati na početak
    music.play();
}

