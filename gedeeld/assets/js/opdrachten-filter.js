// Client-side facetfilter voor het opdrachtenoverzicht.
//
// Binnen het facet "expertises" geldt OF (expertise=A OF expertise=B).
// Tussen de zoekterm en het facet geldt EN.
// De actieve filters staan in de query-string, zodat een gefilterd overzicht
// deelbaar en bookmarkbaar is en de terugknop werkt.

(function () {
  "use strict";

  // Alleen het 'expertises'-facet voor opdrachten
  const FACETTEN = ["expertises"];

  function init() {
    // DOM-elementen
    const lijst = document.getElementById("opdrachten-lijst");
    if (!lijst) return;

    const items = Array.from(lijst.querySelectorAll(".opdracht-item"));
    const tellerEl = document.getElementById("zichtbaar-aantal");
    const geenResultaten = document.getElementById("geen-resultaten");
    const wisKnop = document.getElementById("filters-wissen");
    const zoekVeld = document.getElementById("opdrachten-zoek");
    const rijen = Array.from(document.querySelectorAll("nldd-list-item[data-facet]"));

    // Voorsplitsen van data-attributen (spatiegescheiden slugs)
    const itemWaarden = new Map(
      items.map((item) => [
        item,
        Object.fromEntries(
          FACETTEN.map((facet) => [
            facet,
            (item.dataset[facet] || "").split(" ").filter(Boolean),
          ])
        ),
      ])
    );

    // Titel, beschrijving en eigenaar staan in data-tekst (kleine letters)
    const itemTekst = new Map(items.map((item) => [item, item.dataset.tekst || ""]));

    // Haal de huidige zoekterm op
    function zoekterm() {
      return (zoekVeld ? zoekVeld.value || "" : "").trim().toLowerCase();
    }

    // Check of een rij (nldd-list-item) aangevinkt is
    const isAan = (rij) => rij.hasAttribute("checked");

    // Spiegel de status van de rij naar de decoratieve nldd-checkbox
    function spiegelVakje(rij) {
      const vakje = rij.querySelector("nldd-checkbox");
      if (vakje) vakje.toggleAttribute("checked", isAan(rij));
    }

    // Programmatisch een rij zetten (gebruikt voor URL-herstel en filters wissen)
    function zetRij(rij, aan) {
      rij.toggleAttribute("checked", aan);
      spiegelVakje(rij);
    }

    // Haal de huidige selectie op
    function huidigeSelectie() {
      const selectie = {};
      for (const facet of FACETTEN) selectie[facet] = [];
      for (const rij of rijen) {
        if (isAan(rij)) selectie[rij.dataset.facet].push(rij.dataset.value);
      }
      return selectie;
    }

    // Check of een item past bij de huidige selectie
    function pastBijSelectie(waarden, selectie) {
      return FACETTEN.every((facet) => {
        const gekozen = selectie[facet];
        if (gekozen.length === 0) return true;
        return gekozen.some((waarde) => waarden[facet].includes(waarde));
      });
    }

    // Pas filters toe en update de UI
    function pasToe({ updateUrl = true } = {}) {
      const selectie = huidigeSelectie();
      const term = zoekterm();
      const actief =
        FACETTEN.some((facet) => selectie[facet].length > 0) || term !== "";

      let zichtbaar = 0;
      for (const item of items) {
        const past =
          pastBijSelectie(itemWaarden.get(item), selectie) &&
          (term === "" || itemTekst.get(item).includes(term));
        item.hidden = !past;
        if (past) zichtbaar++;
      }

      // Update de teller
      if (tellerEl) tellerEl.textContent = String(zichtbaar);

      // Toon/verberg "geen resultaten"-melding
      if (geenResultaten) geenResultaten.hidden = zichtbaar !== 0;

      // Toon/verberg "Wis alle filters"-knop
      if (wisKnop) wisKnop.toggleAttribute("hidden", !actief);

      // Update de URL (voor bookmarking en delen)
      if (updateUrl) {
        const params = new URLSearchParams();
        for (const facet of FACETTEN) {
          for (const waarde of selectie[facet]) {
            params.append(facet, waarde);
          }
        }
        if (term) params.set("zoek", term);
        const query = params.toString();
        history.replaceState(
          null,
          "",
          query ? `?${query}` : window.location.pathname
        );
      }
    }

    // Gedelegeerd click-event voor de filterrij
    // Gebruikt composedPath om de rij te vinden in de shadow DOM
    document.addEventListener("click", (event) => {
      const rij = event.composedPath().find(
        (knoop) =>
          knoop instanceof Element &&
          knoop.matches &&
          knoop.matches("nldd-list-item[data-facet]")
      );
      if (!rij) return;

      // Wacht tot het component zijn eigen checked-attribuut heeft bijgewerkt
      requestAnimationFrame(() => {
        spiegelVakje(rij);
        pasToe();
      });
    });

    // Knop om de sidebar te openen (voor mobiel)
    const openKnop = document.getElementById("filters-openen");
    const sectie = document.querySelector("nldd-sidebar-section");
    if (openKnop && sectie) {
      const openen = () => {
        if (typeof sectie.show === "function") sectie.show();
        else if (typeof sectie.toggle === "function") sectie.toggle();
      };
      openKnop.addEventListener("click", openen);

      // Voor het overflowmenu in de toolbar
      const menuItem = document.getElementById("filters-openen-menu");
      if (menuItem) menuItem.addEventListener("select", openen);
    }

    // "Wis alle filters"-knop
    if (wisKnop) {
      wisKnop.addEventListener("click", () => {
        for (const rij of rijen) zetRij(rij, false);
        if (zoekVeld) zoekVeld.value = "";
        pasToe();
      });
    }

    // Zoekveld met debounce
    if (zoekVeld) {
      let timer = null;
      ["input", "change", "search"].forEach((evt) => {
        zoekVeld.addEventListener(evt, (e) => {
          if (e.detail && typeof e.detail.value === "string") {
            zoekVeld.value = e.detail.value;
          }
          clearTimeout(timer);
          timer = setTimeout(() => pasToe(), 150); // Debounce van 150ms
        });
      });
    }

    // Herstel selectie uit de URL bij laden
    const params = new URLSearchParams(window.location.search);
    if ([...params.keys()].length) {
      for (const rij of rijen) {
        zetRij(
          rij,
          params.getAll(rij.dataset.facet).includes(rij.dataset.value)
        );
      }
      if (zoekVeld && params.get("zoek")) {
        zoekVeld.value = params.get("zoek");
      }
    }

    // Initialiseer filters (zonder URL-update)
    pasToe({ updateUrl: false });
  }

  // Wacht tot de custom elements (nldd-list-item, nldd-checkbox, etc.) klaar zijn
  if (window.customElements) {
    Promise.all([
      customElements.whenDefined("nldd-list-item"),
      customElements.whenDefined("nldd-checkbox"),
      customElements.whenDefined("nldd-search-field"),
    ]).then(init);
  } else {
    document.addEventListener("DOMContentLoaded", init);
  }
})();
