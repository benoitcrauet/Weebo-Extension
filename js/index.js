const fieldChannel = document.getElementById("selectchannel");
const fieldConductor = document.getElementById("selectconductor");
const fieldEnable = document.getElementById("weeboenable");

const buttonPreload = document.getElementById("conductorpreload");


// Liste des canaux
let channelList = [];


// Valeurs actuelles
let currentChannel = null;
let currentConductor = null;
let currentEnabled = false;


// Quand on change la valeur du viewer
fieldChannel.addEventListener("change", (e) => {
    // On stocke ça en session
    chrome.storage.session.set({
        currentChannel: e.target.value,
        currentConductor: null
    });

    currentChannel = e.target.value;
    currentConductor = null;

    // On change les options du select conductor
    fillConductorsSelect(e.target.value);

    // On désactive l'app
    enableApp(false);

    updateDisplay();
});

// Quand on change la valeur du conducteur
fieldConductor.addEventListener("change", (e) => {
    // On stocke ça en session
    chrome.storage.session.set({
        currentConductor: e.target.value
    });

    currentConductor = e.target.value;

    // On désactive l'app
    enableApp(false);

    updateDisplay();
});

// Quand on change la valeur de l'activation
fieldEnable.addEventListener("change", (e) => {
    // On stocke ça en session
    chrome.storage.session.set({
        currentEnabled: e.target.checked
    });

    currentEnabled = e.target.checked;

    updateDisplay();
});

// Quand on clique sur le bouton de préloading
buttonPreload.addEventListener("click", (e) => {
    if(confirm("Attention : cette action va fermer TOUS les onglets actuels du navigateur et va les remplacer par les différents liens du conducteur sélectioné.\n\nÊtes-vous sûr.e de vouloir effectuer cette action ?")) {
        chrome.windows.getCurrent((currentWindow) => {
            chrome.runtime.sendMessage({
                action: "trigger.preload",
                windowId: currentWindow.id
            });
        });
        enableApp();
    }
});

// Chargement de la page principale

// Récupération des valeurs actuelles
chrome.storage.session.get(["currentChannel", "currentConductor", "currentEnabled"]).then((d) => {
    currentChannel = d.currentChannel ?? null;
    currentConductor = d.currentConductor ?? null;
    currentEnabled = d.currentEnabled ?? false;

    fieldEnable.checked = currentEnabled;

    updateDisplay();
});

// On récupère la liste des canaux
chrome.storage.session.get(["channelList"]).then((d) => {
    // On ajoute l'option d'invitation
    fieldChannel.innerHTML = `<option value="" disabled selected hidden>Choisissez un canal...</option>`;

    // On set la liste des canaux en mémoire
    channelList = d.channelList;

    let idList = [];
    // On rajoute les options des canaux web
    for(const id in d.channelList) {
        const channel = d.channelList[id];

        console.log(id, channel);

        // On crée l'option
        let opt = new Option(
            `[${channel.parentShow.name}] ${channel.channel.name}`,
            id
        );

        fieldChannel.options.add(opt);

        // On ajoute l'ID à la liste
        idList.push(id);
    }

    // On présélectionne la bonne entrée du select
    chrome.storage.session.get("currentChannel", (d) => {
        if(idList.includes(d.currentChannel))
            fieldChannel.value = d.currentChannel;

        // On rempli maintenant le select conducteur
        fillConductorsSelect(d.currentChannel);
    });
});




/**
 * Rempli le select des conducteurs selon l'ID du canal web spécifié
 * @param {string} channelID ID du canal web
 */
function fillConductorsSelect(channelID) {
    // On vide le champ des conducteurs
    fieldConductor.innerHTML = "";
    fieldConductor.value = "";

    // On ajoute l'option d'invitation
    fieldConductor.innerHTML = `<option value="" disabled selected hidden>Choisissez un conducteur...</option>`;

    if(channelList[channelID] !== undefined) {
        const conductors = channelList[channelID].conductors;

        // On liste les conducteurs
        let idList = [];
        for(const k in conductors) {
            const conductor = conductors[k];

            fieldConductor.options.add(
                new Option(
                    conductor.name,
                    conductor.id
                )
            );

            // On ajoute l'id du conducteur à la liste
            idList.push(conductor.id);
        }

        // On présélectionne la bonne entrée du select
        chrome.storage.session.get("currentConductor", (d) => {
            if(idList.includes(d.currentConductor))
                fieldConductor.value = d.currentConductor;
        });
    }
}


/**
 * Met à jour l'affichage du formulaire selon les valeurs en vigueur
 */
function updateDisplay() {
    fieldConductor.disabled = currentChannel==null;
    buttonPreload.disabled = currentConductor==null;

    fieldEnable.disabled = currentChannel==null || currentConductor==null;
    if(fieldEnable.disabled) enableApp(false);

    if(currentEnabled)
        document.body.classList.add("active");
    else
        document.body.classList.remove("active");
}


/**
 * Active ou désactive l'app
 * @param {boolean} [enable=true] Active ou non l'app
 */
function enableApp(enable=true) {
    fieldEnable.checked = enable;
    currentEnabled = enable;
    chrome.storage.session.set({
        currentEnabled: enable
    });
    updateDisplay();
}