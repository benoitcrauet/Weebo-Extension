const fieldUrlList = document.getElementById("urllist");

const buttonSubmit = document.getElementById("configSubmit");


buttonSubmit.addEventListener("click", async function(e) {
    await chrome.storage.local.set({
        urlList: fieldUrlList.value
    });

    // Fermeture de la page
    window.close();
});


// Chargement de la page config

// Récupération des paramètres
chrome.storage.local.get(["urlList"]).then((d) => {
    fieldUrlList.value = d.urlList ?? "";
});

chrome.storage.session.get(["currentEnabled"]).then((d) => {
    if(d.currentEnabled)
        document.body.classList.add("active");
    else
        document.body.classList.remove("active");
});