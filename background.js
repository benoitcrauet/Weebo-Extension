let channelList = {};

let currentChannel = null;
let currentConductor = null;
let currentEnabled = null;

let currentConductorLinksURL = null;
let currentConductorDetailsURL = null;

let currentLastMediaID = null;


let tabsList = {}; // Relation tabs/mediaID
let lastFocusedWindowId = null;

// A la réception de nouveaux paramètres...
chrome.storage.onChanged.addListener(async (changes, area) => {
    // PARAMETRES LOCAUX
    if(area=="local") {
        console.debug("CHANGES ", changes);
        for(const k in changes) {

            // Si c'est urlList, on relance un scan des canaux
            if(k == "urlList") {
                let newChannelList = await makeChannelsList(changes.urlList.newValue);
                await chrome.storage.session.set({
                    channelList: newChannelList
                });
            }
        }
    }

    // PARAMETRES SESSION
    if(area=="session") {


        if(changes.currentChannel !== undefined) {
            currentChannel = changes.currentChannel.newValue;
            currentConductor = null;
            enableApp(false);
            currentConductorDetailsURL = null;
            currentConductorLinksURL = null;
            currentLastMediaID = null;

            console.debug("New current channel", currentChannel);
        }
        
        if(changes.currentConductor !== undefined) {
            currentConductor = changes.currentConductor.newValue;
            enableApp(false);
            currentConductorDetailsURL = null;
            currentConductorLinksURL = null;
            currentLastMediaID = null;

            console.debug("New current conductor", currentConductor);

            if(channelList[currentChannel].conductors) {
                for(let k in channelList[currentChannel].conductors) {
                    const conductor = channelList[currentChannel].conductors[k];

                    if(conductor.id == currentConductor) {
                        currentConductorDetailsURL = conductor.urls.conductor_details;
                        currentConductorLinksURL = conductor.urls.all_links;

                        console.debug("New URL for all links:", currentConductorLinksURL);
                        console.debug("New URL for details:", currentConductorDetailsURL);

                        break;
                    }
                }
            }
        }
        
        if(changes.currentEnabled !== undefined) {
            currentEnabled = changes.currentEnabled.newValue;
            setEnabledBadge(currentEnabled);
            console.debug("New current enabled", currentEnabled);
        }
        
        if(changes.channelList !== undefined) {
            console.debug("Receiving new channel list...");
            channelList = changes.channelList.newValue;
            console.debug("New channels list", channelList);
        }
    }
});


// Triggers...
chrome.runtime.onMessage.addListener(async (message, sender, sensResponse) => {
    if(message.action === "trigger.preload" && message.windowId) {
        // C'est une demande de préload !
        // On ferme les autres fenêtres
        closeAllWindowsExcept(message.windowId);

        // On récupère les détails du conducteur
        const conductor = await getConductorLinks(currentConductorLinksURL);

        // On liste les liens
        let linkList = {};
        for(const k in conductor.links) {
            const link = conductor.links[k];

            linkList[link.id] = link.path; // On ajoute le lien à la liste
        }

        // On remplace les onglets
        replaceAllTabsInWindow(lastFocusedWindowId, linkList);
    }
});


// Quand on change de focus on stocke l'ID de la fenêtre
chrome.windows.onFocusChanged.addListener((windowId) => {
    if(windowId !== chrome.windows.WINDOW_ID_NONE) {
        lastFocusedWindowId = windowId;
        console.debug("Window ID", lastFocusedWindowId, "is now focused.");
    }
});




// Régulièrement on récupère les informations des canaux
setInterval(() => {
    console.debug("Updating channels list...");
    chrome.storage.local.get(["urlList"]).then(async (d) => {
        let newChannelList = await makeChannelsList(d.urlList);
        chrome.storage.session.set({
            channelList: newChannelList
        });
    });
}, 60000);


// Régulièrement on récupère le dernier lien à ouvrir
setInterval(async () => {
    if(currentEnabled) {
        if(currentConductorDetailsURL==null || currentChannel==null || currentConductor==null) {
            enableApp(false);
        }
        else {
            console.debug("Ping");

            const details = await getConductorDetails(currentConductorDetailsURL);

            if(details!==false) {
                // On récupère le dernier ID web demandé
                let lastMediaID = details.currentMediaWeb;
                
                // Si la valeur change...
                if(lastMediaID != currentLastMediaID) {
                    currentLastMediaID = lastMediaID;

                    // On récupère tous les liens
                    let links = await getConductorLinks(currentConductorLinksURL);

                    // On réordonne les onglets selon le conducteur
                    for(let k in links.links) {
                        const media = links.links[k];

                        // On met à jour l'index de l'onglet
                        let currentTab = mediaGetFromMediaID(media.id);

                        if(currentTab != false) {
                            chrome.tabs.move(currentTab.tabID, { index: media.index });
                        }
                    }

                    // On va chercher l'ID de l'onglet correspondant
                    let tabObject = mediaGetFromMediaID(lastMediaID);

                    // Si l'onglet existe, on le focus, sinon on le crée
                    if(tabObject!==false) {
                        // On focus l'onglet
                        console.log("Existing media asked! Focusing on tab", tabObject.tabID, "...");
                        chrome.tabs.update(tabObject.tabID, { active: true });
                    }
                    else {
                        // On crée l'onglet avec l'URL du média
                        console.log("New media asked! Creating tab...");

                        // On explore les liens à la recherche de notre nouveau media ID
                        let mediaObject = null;
                        for(let k in links.links) {
                            const media = links.links[k];

                            if(media.id == lastMediaID) {
                                mediaObject = media;
                            }
                        }

                        if(mediaObject !== null) {
                            chrome.tabs.create({ url: mediaObject.path, index: mediaObject.index }, (tab) => {
                                mediaCreate(mediaObject.id, mediaObject.path, tab.id);
                            });
                        }
                    }
                }
            }
            else {
                chrome.windows.create({
                    url: "pingerror.html",
                    type: "popup",
                    width: 450,
                    height: 350,
                    focused: true
                });
                enableApp(false);
            }
        }
    }
}, 2000);




/**
 * Fonction d'initialisation de l'extension
 */
function init() {
    chrome.storage.local.get(["urlList"]).then(async (d) => {
        let newChannelList = await makeChannelsList(d.urlList);
        chrome.storage.session.set({
            channelList: newChannelList
        });
    });


    // On récupère la dernière fenêtre utilisée
    chrome.windows.getLastFocused({ populate: true }, (window) => {
        lastFocusedWindowId = window.id;
        console.debug("Window ID", lastFocusedWindowId, "is now focused.");
    });
}



/**
 * Transforme une liste d'URL en objet contenant les informations de chaque canal associé.
 * @param {string} urlList Liste des URLs (un par ligne) à analyser
 * @returns Objet contenant les différents canaux. Nettoyé des URL invalides.
 */
async function makeChannelsList(urlList) {
    let channelList = {};

    urlList = urlList ?? "";

    for(const url of urlList.split("\n").map(url => url.trim())) {
        if(url != "") {
            let channel = await getChannelInformations(url);

            if(channel!==false) {
                // On rajoute l'url
                channel.url = url;
                channelList[channel.channel.id] = channel;
            }
        }
    };

    return channelList;
}



/**
 * Récupère tous les liens d'un conducteur.
 * @param {string} url URL de requête des liens
 * @returns Objet contenant les liens du conducteur. False le cas échéant.
 */
async function getConductorLinks(url) {
    try {
        const response = await fetch(url);
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
            const obj = await response.json();
            
            if(obj.conductor!==undefined && obj.links!==undefined) {
                return obj;
            }
            else {
                console.error("URL "+url+" does not contains valid datas.");
                return false;
            }
        } else {
            console.error("URL "+url+" does not contains a valid JSON structure.");
            return false;
        }
    } catch (error) {
        console.error("Error while get URL content", url, ":", error.message);
        return false;
    }
}


/**
 * Récupère tous les détails d'un conducteur.
 * @param {string} url URL de requête des détails
 * @returns Objet contenant les détails du conducteur. False le cas échéant.
 */
async function getConductorDetails(url) {
    try {
        const response = await fetch(url);
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
            const obj = await response.json();
            
            return obj;
        } else {
            console.error("URL "+url+" does not contains a valid JSON structure.");
            return false;
        }
    } catch (error) {
        console.error("Error while get URL content", url, ":", error.message);
        return false;
    }
}


/**
 * Récupère les informations du canal web spécifié par l'URL d'entrée.
 * @param {string} url URL du canal web à analyser
 * @returns Objet contenant les informations. False en cas d'erreur.
 */
async function getChannelInformations(url) {
    try {
        const response = await fetch(url);
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
            const obj = await response.json();
            
            if(obj.channel!==undefined && obj.parentShow!==undefined && obj.conductors!==undefined) {
                return obj;
            }
            else {
                console.error("URL "+url+" does not contains valid datas.");
                return false;
            }
        } else {
            console.error("URL "+url+" does not contains a valid JSON structure.");
            return false;
        }
    } catch (error) {
        console.error("Error while get URL content", url, ":", error.message);
        return false;
    }
}


/**
 * Ferme toutes les fenêtres chrome sauf celle spécifiée
 * @param {number} windowsId ID de la window à laisser ouverte
 */
function closeAllWindowsExcept(windowId) {
    console.log("Closing all windows except ID ", windowId);

    chrome.windows.getAll({ populate: true}, windows => {
        windows.forEach(window => {
            if(window.id !== windowId) {
                console.log("- Closing window ID ", window.id);
                chrome.windows.remove(window.id);
            }
        });
    });
}


/**
 * 
 * @param {number} windowId ID de la fenêtre dont les onglets doivent être remplacés
 * @param {Object} urlList Objet contenant les différents URL (mediaID => url)
 */
function replaceAllTabsInWindow(windowId, urlList) {
    // On récupère les onglets actuels
    chrome.tabs.query({ windowId: windowId }, (tabs) => {
        const tabIds = tabs.map(tab => tab.id);

        // On crée les nouveaux onglets
        let index = 0;
        for(const mediaID in urlList) {
            const url = urlList[mediaID];

            chrome.tabs.create({ windowId: windowId, url: url, index: index++ }, (tab) => {
                mediaCreate(mediaID, url, tab.id)
            });
        }
        
        // On supprime les anciens onglets
        chrome.tabs.remove(tabIds);
    });
}




/**
 * Supprime toutes les entrées dans la base de données médias
 * @returns Base de données des médias modifiée.
 */
function mediaClear() {
    tabsList = {};

    return tabsList;
}


/**
 * Crée une nouvelle entrée dans la base de données des médias web
 * 
 * @param {string} mediaID ID du média Weebo
 * @param {string} url URL du média
 * @param {number} tabID ID de l'onglet associé
 * @returns 
 */
function mediaCreate(mediaID, url, tabID) {
    let newObj = {
        tabID: tabID,
        mediaID: mediaID,
        url: url
    };

    tabsList[mediaID] = newObj;

    return newObj;
}


/**
 * Retourne l'objet média depuis son ID Weebo.
 * @param {string} mediaID ID du média ciblé
 * @returns Objet média ou false le cas échéant.
 */
function mediaGetFromMediaID(mediaID) {
    for(const k in tabsList) {
        const media = tabsList[k];

        if(media.mediaID == mediaID) {
            return media;
        }
    }
    return false;
}


/**
 * Retourne l'objet média depuis son ID d'onglet.
 * @param {string} tabID ID de l'onglet ciblé
 * @returns Objet média ou false le cas échéant.
 */
function mediaGetFromTabID(tabID) {
    for(const k in tabsList) {
        const media = tabsList[k];

        if(media.tabID == mediaID) {
            return media;
        }
    }
    return false;
}





/**
 * Active ou désactive l'app
 * @param {boolean} [enable=true] Active ou non l'app
 */
function enableApp(enable=true) {
    currentEnabled = enable;
    chrome.storage.session.set({
        currentEnabled: enable
    });
    setEnabledBadge(enable);
}




function setEnabledBadge(enabled=true) {
    if(enabled) {
        chrome.action.setIcon({
            path: {
                "64": "icons/logoOn64.png",
                "128": "icons/logoOn128.png",
                "256": "icons/logoOn256.png",
                "512": "icons/logoOn512.png",
            }
        });
    }
    else {
        chrome.action.setIcon({
            path: {
                "64": "icons/logo64.png",
                "128": "icons/logo128.png",
                "256": "icons/logo256.png",
                "512": "icons/logo512.png",
            }
        });
    }
}



init();