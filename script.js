/*
TODO
- role stereotypes DONE
- filtering stereotypes DONE
- remove bug tab DONE
- try font sizing DONE
- animate dynamic aspects
- summaries to sidebar DONE
- architecture recovery/clustering
- collapse the classes
- more padding inside packages DONE
- tweak klay parameters
*/

import { Neo4jClient } from "./neo4j.js";
import { shadeHexColor } from "./colors.js";

const neo4jClient = new Neo4jClient();
let selectedNodeId = '';
let layerDepth = 1;
let dependencyDepth = 1;

document.addEventListener('DOMContentLoaded', function () { // on dom ready
  const filePrefix = (new URLSearchParams(window.location.search)).get('p')

  if (filePrefix) {
    const eles = fetch(`data/${filePrefix ? filePrefix : ''}.json`)
        .then(res => res.json())
        .then(json => json.elements)
        .then(eles => prepareEles(eles))

    document.getElementById("filename").textContent = `Software Visualization: ${filePrefix}.json`;

    const style = fetch('style.cycss')
        .then(res => res.text());

    Promise.all([eles, style])
        .then(initCy);
  } else {
    loadRootGraph();
  }
});

const prepareEles = function (eles) {

  eles.nodes.forEach((node) => {
    node.data.name = node.data.properties.shortname ? node.data.properties.shortname : node.data.properties.simpleName;
    node.data.label = `${node.data.name}`;
  });

  eles.edges.forEach((edge) => {
    edge.data.interaction = edge.data.label ? edge.data.label : edge.data.labels.join();
  });

  return eles;
}

function renderGraph(getGraph, ...params) {
  console.info(`start loading... (with params ${params})`);
  const graph = getGraph(...params).then((graph) => prepareEles(graph));
  const style = fetch('style.cycss')
      .then(res => res.text());

  Promise.all([graph, style])
      .then(initCy)
      .then(() => console.info('loading finished.'));
}

window.loadRootGraph = function () {
  selectedNodeId = undefined;
  renderGraph(neo4jClient.getAllDomains.bind(neo4jClient));
}

window.refreshGraph = function () {
  if (!selectedNodeId) return;
  const showInternalRels = document.getElementById('showInternalRelationships')?.checked || false;
  const showExternalRels = document.getElementById('showExternalRelationships')?.checked || false;
  const onlyShowInternalRels = !showExternalRels;
  const onlyShowExternalRels = !showInternalRels;

  const showDependencies = document.getElementById('showDependencies')?.checked || false;
  const showDependents = document.getElementById('showDependents')?.checked || false;

  const dependencyRange = document.getElementById('filterDependencyRange').checked;
  let minDependencies = dependencyRange ? document.getElementById('min-no-dependencies').value : undefined;
  let maxDependencies = dependencyRange ? document.getElementById('max-no-dependencies').value : undefined;
  if (maxDependencies >= 21) maxDependencies = undefined;

  const dependentRange = document.getElementById('filterDependentRange').checked;
  let minDependents = dependentRange ? document.getElementById('min-no-dependents').value : undefined;
  let maxDependents = dependentRange ? document.getElementById('max-no-dependents').value : undefined;
  if (maxDependents >= 21) maxDependents = undefined;

  renderGraph(neo4jClient.getDomainModules.bind(neo4jClient),
      selectedNodeId, layerDepth, dependencyDepth, onlyShowInternalRels, onlyShowExternalRels, showDependencies, showDependents,
      { min: minDependencies, max: maxDependencies}, { min: minDependents, max: maxDependents});
}

function setParents(relationship, inverted) {
  cy.edges("#parentRel").removeClass("parentRel")
  if (inverted) {
    cy.edges(`[interaction = "${relationship}"]`).forEach(edge => {
      edge.source().move({ parent: edge.target().id() });
    });
  } else {
    cy.edges(`[interaction = "${relationship}"]`).forEach(edge => {
      edge.target().move({ parent: edge.source().id() });
    });
  }
  cy.edges(`[interaction = "${relationship}"]`).addClass("parentRel");
}

let parentRel = "contains";

const rs_colors = {
  "Controller": ["#984ea3", "#decbe4"],
  "Coordinator": ["#4daf4a", "#ccebc5"],
  "Information Holder": ["#e4105c", "#fbb4ae"],
  "Interfacer": ["#ff7f00", "#fed9a6"],
  "Service Provider": ["#377eb8", "#b3cde3"],
  "Structurer": ["#f781bf", "#fddaec"],
};

const ft_colors = [
  "#8dd3c7",
  "#ffffb3",
  "#bebada",
  "#fb8072",
  "#80b1d3",
  "#fdb462",
  "#b3de69",
  "#fccde5",
  "#d9d9d9",
  "#bc80bd",
  "#ccebc5",
  "#ffed6f",
];

function initCy([graph, style]) {
  const cy = window.cy = cytoscape({

    container: document.getElementById('cy'),

    elements: {
      nodes: graph.nodes,
      edges: graph.edges
    },

    style,

    wheelSensitivity: 0.25,
  });

  // Give every node their corresponding color
  cy.nodes().forEach((n) => {
    const hexColor = n.data('properties.color');
    if (!hexColor) return;
    const depth = Number(n.data('properties.depth'));
    const alpha = (4 - depth) * 0.15;
    const lightened = shadeHexColor(hexColor, alpha);
    n.style('background-color', lightened);
  });

  cy.edges().forEach((e) => {
    const weight = e.data('properties.weight');
    if (!weight) return;
    e.style('width', 1.5 * Math.sqrt(weight));
  })

  setParents(parentRel, false);

  fillRelationshipToggles(cy);
  fillFeatureDropdown(cy);

  bindRouters();

  return cy;
}

// Get a reference to the div element
var infoTitle = document.getElementById("infotitle");
var infoBody = document.getElementById("infobody");

// Add a click event listener to the div
infoTitle.addEventListener("click", function () {
  console.trace('click infoTitle');
  if (infoBody.style.display === "none") {
    infoBody.style.display = "block";
    infoTitle.style.borderBottomLeftRadius = 0;
    infoTitle.style.borderBottomRightRadius = 0;
    infoTitle.style.borderBottom = "1px solid #9b999b";
  } else {
    infoBody.style.display = "none";
    infoTitle.style.borderBottomLeftRadius = "inherit";
    infoTitle.style.borderBottomRightRadius = "inherit";
    infoTitle.style.borderBottom = 0;
  }
});

function bindRouters() {

  // right click dims the element
  cy.on('cxttap', 'node,edge',
    evt => {
      // console.trace('click cxttap');
      // evt.target.addClass("dimmed")
      // const interactions = Array.from(document
      //   .querySelectorAll('input[name="showrels"]'))
      //   .filter(cb => cb.checked).map(cb => cb.value);
      //
      // const edges = evt.target.connectedEdges()
      //   .filter(e => interactions.includes(e.data('interaction')));
      // edges.addClass("dimmed");
    });

  // left click highlights the node and its connected edges and nodes
  cy.on('tap', 'node', function (evt) {
    // console.trace('click tap node');
    // evt.target.removeClass("dimmed")
    //
    // // currently visible relationship types
    // const interactions = Array.from(document
    //   .querySelectorAll('input[name="showrels"]'))
    //   .filter(cb => cb.checked).map(cb => cb.value);
    //
    // const edges = evt.target.connectedEdges()
    //   .filter(e => interactions.includes(e.data('interaction')));
    // edges.removeClass("dimmed");
    // edges.connectedNodes().removeClass("dimmed");
    const element = this.id();
    selectedNodeId = element;
    refreshGraph();
  });

  // left click highlights the edge and its connected nodes
  cy.on('tap', 'edge', evt => {
    // console.trace('click tap edge');
    // evt.target.removeClass("dimmed");
    // evt.target.connectedNodes().removeClass("dimmed");
  });

  cy.on('mouseover', 'node', evt => {
    var infoHeader = document.createElement("h3");
    var infoSubeader = document.createElement("p");
    var infoText = document.createElement("p");

    infoHeader.textContent = evt.target.data()["properties"]["simpleName"];
    infoText.textContent = evt.target.data()["properties"]["description"] ? evt.target.data()["properties"]["description"] : "(no description)";

    

    if (evt.target.data()['labels'].includes('Structure')) {
      if (evt.target.data()["properties"]["rs"]) {
        infoBody.style.backgroundColor = rs_colors[evt.target.data()["properties"]["rs"]][1];
        infoSubeader.innerHTML = `<b><i>${evt.target.data()["properties"]["kind"]}</i> – ${evt.target.data()["properties"]["rs"]}</b>`;
      } else {
        infoBody.style.backgroundColor = "inherit";
        infoSubeader.innerHTML = `<b><i>${evt.target.data()["properties"]["kind"]}</i></b>`;
      }
    } else if (evt.target.data()['labels'].includes('Container')) {
      infoBody.style.backgroundColor = "inherit";
      infoSubeader.innerHTML = `<b><i>${evt.target.data()["properties"]["kind"]}</i></b>`;
    }

    infoBody.innerHTML = "";
    infoBody.appendChild(infoHeader);
    infoBody.appendChild(infoSubeader);
    infoBody.appendChild(infoText);

  });

}

window.relayout = function (layout) {
  cy.layout({
    name: layout, animate: true,
    nodeDimensionsIncludeLabels: true,
    klay: {
      direction: 'DOWN',
      edgeRouting: 'ORTHOGONAL',
      routeSelfLoopInside: true,
      thoroughness: 4,
      spacing: 32
    }
  }).run();
};

window.saveAsSvg = function (filename) {
  const svgContent = cy.svg({ scale: 1, full: true, bg: 'beige' });
  const blob = new Blob([svgContent],
    { type: "image/svg+xml;charset=utf-8" });
  saveAs(blob, filename);
};

window.getSvgUrl = function () {
  const svgContent = cy.svg({ scale: 1, full: true, bg: 'beige' });
  const blob = new Blob([svgContent],
    { type: "image/svg+xml;charset=utf-8" });
  return URL.createObjectURL(blob);
};

window.setVisible = function (ele) {
  cy.edges(`[interaction = "${ele.value}"]`)
    .toggleClass("hidden", !ele.checked);
};

window.setLineBends = function (ele) {
  if (ele.checked) {
    cy.edges(`[interaction = "${ele.name}"]`)
      .style("curve-style", ele.value);
  }
};

window.fileUpload = function () {
  const fileSelector = document.getElementById("file-selector")
  fileSelector.click();
  fileSelector.addEventListener('change', (event) => {
    const file = event.target.files[0];
    const filePrefix = file.name;
    document.getElementById("filename").textContent = `Software Visualization: ${filePrefix}`;
    const reader = new FileReader();
    reader.readAsText(file, 'UTF-8');
    reader.onload = function (e) {
      const json = JSON.parse(e.target.result);
      const eles = prepareEles(json.elements);
      const style = fetch('style.cycss')
        .then(res => res.text());

      Promise.all([eles, style])
        .then(initCy);
    }
  });
}

let flip = true;
window.toggleVisibility = function () {
  cy.style().selector('.dimmed')
    .style({
      'display': flip ? 'none' : 'element'
    })
    .update();
  flip = !flip;
};

window.fillRelationshipToggles = function (_cy) {

  const table = document.getElementById("reltab"); // Get the table element
  table.innerHTML = "";

  // Create the thead element
  const thead = document.createElement("thead");

  // Create the tr element for the table header row
  const headerRow = document.createElement("tr");

  // Create the th elements for the table header cells
  const th1 = document.createElement("th");
  th1.textContent = "Connection";
  const th2 = document.createElement("th");
  th2.textContent = "Ortho";
  const th3 = document.createElement("th");
  th3.textContent = "Bezier";

  // Append the th elements to the header row
  headerRow.appendChild(th1);
  headerRow.appendChild(th2);
  headerRow.appendChild(th3);

  // Append the header row to the thead element
  thead.appendChild(headerRow);

  // Append the thead element to the table element
  table.appendChild(thead);

  _cy.edges().map(e => e.data('interaction'))
    .filter((v, i, s) => s.indexOf(v) === i)
    .forEach(l => {
      // Create a new row (tr)
      const row = document.createElement("tr");

      // Create the first cell (td) with a label and checkbox
      const cell1 = document.createElement("td");
      const label = document.createElement("label");
      label.setAttribute("for", l);
      const checkbox = document.createElement("input");
      checkbox.setAttribute("type", "checkbox");
      checkbox.setAttribute("id", l);
      checkbox.setAttribute("name", "showrels");
      checkbox.setAttribute("onchange", "setVisible(this)");
      checkbox.setAttribute("value", l);
      checkbox.checked = !["contains"].includes(l);
      const labelText = document.createTextNode(l);
      label.appendChild(checkbox);
      label.appendChild(labelText);
      cell1.appendChild(label);
      row.appendChild(cell1);

      // Create the second cell (td) with a radio button for taxi option
      const cell2 = document.createElement("td");
      const taxiRadio = document.createElement("input");
      taxiRadio.setAttribute("type", "radio");
      taxiRadio.setAttribute("onchange", "setLineBends(this)");
      taxiRadio.setAttribute("id", `${l}-ort`);
      taxiRadio.setAttribute("name", l);
      taxiRadio.setAttribute("value", "taxi");
      cell2.appendChild(taxiRadio);
      row.appendChild(cell2);

      // Create the third cell (td) with a radio button for bezier option
      const cell3 = document.createElement("td");
      const bezierRadio = document.createElement("input");
      bezierRadio.setAttribute("type", "radio");
      bezierRadio.setAttribute("onchange", "setLineBends(this)");
      bezierRadio.setAttribute("id", `${l}-bez`);
      bezierRadio.setAttribute("name", l);
      bezierRadio.setAttribute("value", "bezier");
      bezierRadio.checked = true;
      cell3.appendChild(bezierRadio);
      row.appendChild(cell3);

      // Append the row to the table
      table.appendChild(row);
    });

  document.querySelectorAll('input[name="showrels"]')
    .forEach((checkbox) => {
      setVisible(checkbox);
    });

}

window.fillFeatureDropdown = function (_cy) {
  let tracesSet = new Set();
  _cy.nodes().forEach((e) => {
    if (e.data("properties.traces")) {
      e.data("properties.traces").forEach((trace) => {
        tracesSet.add(trace);
      });
    }
  });

  let tracesList = Array.from(tracesSet);

  // Get the dropdown element.
  const dropdown = document.getElementById('selectfeature');
  dropdown.innerHTML = "";

  for (let i = 0; i < tracesList.length; i++) {

    const div = document.createElement("div");
    const label = document.createElement("label");
    label.setAttribute("for", `feature-${tracesList[i]}`);
    label.setAttribute("class", "featurelabel")
    const checkbox = document.createElement("input");
    checkbox.setAttribute("type", "checkbox");
    checkbox.setAttribute("id", `feature-${tracesList[i]}`);
    checkbox.setAttribute("name", "showfeatures");
    checkbox.setAttribute("onchange", "showTrace(this)");
    checkbox.setAttribute("value", tracesList[i]);
    const labelText = document.createTextNode(tracesList[i]);
    label.appendChild(checkbox);
    label.appendChild(labelText);

    div.appendChild(label);
    dropdown.appendChild(div);
  }
};


window.fillBugsDropdown = function (_cy) {
  let bugsSet = new Set();
  _cy.nodes().forEach((e) => {
    if (e.data()["properties"]["vulnerabilities"]) {
     e.data()["properties"]["vulnerabilities"].forEach((bug) => {

       bugsSet.add(bug["analysis_name"])
      });
    }
  });


  let bugList = Array.from(bugsSet)
  // console.log(bugList)

  // Get the dropdown element.
  const dropdown = document.getElementById('tab-bugs');
  dropdown.innerHTML = "";

  for (var i = 0; i < bugList.length; i++) {

    const div = document.createElement("div");
    const label = document.createElement("label");
    label.setAttribute("for", `bug-${bugList[i]}`);
    label.setAttribute("class", "buglabel")
    const checkbox = document.createElement("input");
    checkbox.setAttribute("type", "checkbox");
    checkbox.setAttribute("id", `bug-${bugList[i]}`);
    checkbox.setAttribute("name", "showbugs");
    checkbox.setAttribute("onchange", "showBug(this)");
    checkbox.setAttribute("value", bugList[i]);
    const labelText = document.createTextNode(bugList[i]);
    label.appendChild(checkbox);
    label.appendChild(labelText);

    div.appendChild(label);
    dropdown.appendChild(div);
  }
};



function arrayIntersection(arr1, arr2) {
  const result = [];
  for (const item of arr1) {
    if (arr2.includes(item)) {
      result.push(item);
    }
  }
  return result;
}

window.highlight = function (text) {
  if (text) {
    const classes = text.split(/[,\s]+/);
    cy.elements().addClass("dimmed");
    cy.elements('.hidden').removeClass('hidden').addClass("hidden");

    const cy_classes = cy.nodes()
      .filter(function (node) {
        return classes.includes(node.data('simpleName'));
      });
    const cy_edges = cy_classes.edgesWith(cy_classes);
    cy_classes.removeClass("dimmed");
    cy_edges.removeClass("dimmed");
    cy.nodes('[properties.kind = "package"]').removeClass("dimmed");
    cy.nodes('[properties.kind = "file"]').removeClass("dimmed");
  } else {
    cy.elements().removeClass("dimmed");
  }
  cy.edges(`[interaction = "${parentRel}"]`).style("display", "none");
};

window.showRS = function (evt) {
  // console.log(evt.checked, evt.value);
  if (evt.checked) {
    cy.nodes(`[properties.rs = "${evt.value}"]`).removeClass("dimmed");
    cy.nodes(`[properties.rs = "${evt.value}"]`).connectedEdges().filter((e) => {
      console.log(e.source(), e.target());
      return !e.source().hasClass("dimmed") && !e.target().hasClass("dimmed");
    }).removeClass("dimmed");
  } else {
    cy.nodes(`[properties.rs = "${evt.value}"]`).addClass("dimmed");
    cy.nodes(`[properties.rs = "${evt.value}"]`).connectedEdges().addClass("dimmed");
  }
};

window.showTrace = function (evt) {

  const trace_names = Array.from(document.getElementsByName("showfeatures"))
      .filter((e) => e.checked)
      .map((e) => e.value);

  Array.from(document.getElementsByClassName("featurelabel")).forEach((e) => {
    e.style.backgroundColor = "";
  });

  if (trace_names.length > 0) {

    const colorMap = {};
    for (var i = 0; i < trace_names.length; i++) {
      const labelElement = document.querySelector(`label[for="feature-${trace_names[i]}"]`);
      labelElement.style.backgroundColor = ft_colors[i];
      colorMap[trace_names[i]] = ft_colors[i];
    }

    const feature_nodes = cy.nodes().filter(function (node) {
      return trace_names.some(function (trace) {
        return node.data("properties.traces") && node.data("properties.traces").includes(trace);
      });
    });

    const feature_edges = cy.edges().filter(function (edge) {
      return trace_names.some(function (trace) {
        return edge.data("properties.traces") && edge.data("properties.traces").includes(trace);
      });
    });

    cy.elements().addClass("dimmed");
    cy.elements('.hidden').removeClass('hidden').addClass("hidden");
    feature_nodes.removeClass("dimmed");
    feature_edges.removeClass("dimmed");
    cy.nodes('[properties.kind = "package"]').removeClass("dimmed");
    feature_nodes.removeClass("feature_reset");
    feature_edges.removeClass("feature_reset");
    feature_nodes.addClass("feature_shown");
    feature_edges.addClass("feature_shown");

    feature_nodes.forEach((node) => {
      const trc = arrayIntersection(trace_names, node.data("properties.traces"));
      node.style("background-gradient-stop-colors", trc.map((t) => colorMap[t]).join(" "));
      // console.log(trc.map((t) => colorMap[t]).join(" "));
    });

  } else {
    cy.elements().removeClass("dimmed");
    cy.elements().removeClass("feature_shown");
    cy.elements().addClass("feature_reset");
  }
  cy.edges(`[interaction = "${parentRel}"]`).style("display", "none");
};

window.showBug = function (evt) {

  const bug_names = Array.from(document.getElementsByName("showbugs"))
      .filter((e) => e.checked)
      .map((e) => e.value);

  Array.from(document.getElementsByClassName("buglabel")).forEach((e) => {
    e.style.backgroundColor = "";
  });

  if (bug_names.length > 0) {

    const colorMap = {};
    for (var i = 0; i < bug_names.length; i++) {
      const labelElement = document.querySelector(`label[for="bug-${bug_names[i]}"]`);
      labelElement.style.backgroundColor = ft_colors[i];
      colorMap[bug_names[i]] = ft_colors[i];
    }

    const bug_nodes = cy.nodes().filter(function (node) {
      return bug_names.some(function (bug) {
        try {
          return node.data()["properties"]["vulnerabilities"] && node.data()["properties"]["vulnerabilities"].some((e)=> e["analysis_name"]===bug);
        }catch (e){

        }
      });
    });



    cy.elements().addClass("dimmed");
    cy.elements('.hidden').removeClass('hidden').addClass("hidden");
    bug_nodes.removeClass("dimmed");

    cy.nodes('[properties.kind = "file"]').removeClass("dimmed");
    bug_nodes.removeClass("bug_reset");

    bug_nodes.addClass("bug_shown");




    bug_nodes.forEach((node) => {
      const trc = arrayIntersection(bug_names, node.data()["properties"]["vulnerabilities"].map((vul)=> {
        return vul["analysis_name"]
      }));
      node.style("background-gradient-stop-colors", trc.map((t) => colorMap[t]).join(" "));
      // console.log(trc.map((t) => colorMap[t]).join(" "));
    });

  } else {
    cy.elements().removeClass("dimmed");
    cy.elements().removeClass("bug_shown");
    cy.elements().addClass("bug_reset");
  }
  cy.edges(`[interaction = "${parentRel}"]`).style("display", "none");
};

window.openSidebarTab = function (evt, cityName) {
  let i, x, tablinks;
  x = document.getElementsByClassName("sidebar-tab");
  for (i = 0; i < x.length; i++) {
    x[i].style.display = "none";
  }
  tablinks = document.getElementsByClassName("tablink");
  for (i = 0; i < tablinks.length; i++) {
    tablinks[i].className = tablinks[i].className.replace(" active", "");
  }
  document.getElementById(cityName).style.display = "block";
  evt.currentTarget.className += " active";
}

window.updateLayerDepthValue = function (event) {
  const sliderValue = document.getElementById('layer-depth-value');
  sliderValue.innerHTML = event.value;
}

window.updateLayerDepth = function (event) {
  layerDepth = parseInt(event.value);
  refreshGraph();
}

window.updateDependencyDepthValue = function (event) {
  const sliderValue = document.getElementById('dependency-depth-value');
  sliderValue.innerHTML = event.value;
}

window.updateDependencyDepth = function (event) {
  dependencyDepth = parseInt(event.value);
  refreshGraph();
}

window.toggleDependencyRangeSliders = function (event) {
  for (let input of document.getElementById('dependencies-range').getElementsByTagName('input')) {
    input.disabled = !event.checked;
  }
}

window.toggleDependentRangeSliders = function (event) {
  for (let input of document.getElementById('dependents-range').getElementsByTagName('input')) {
    input.disabled = !event.checked;
  }
}

window.updateDependencyRangeSliders = function (event) {
  const sliderValue = document.getElementById(event.id + '-value');
  sliderValue.innerHTML = event.value < 21 ? event.value : 'Inf';
}

function bindPopper(target) {
  let tooltipId = `popper-target-${target.id()}`;
  let existingTarget = document.getElementById(tooltipId);
  if (existingTarget && existingTarget.length !== 0) {
    existingTarget.remove();
  }

  if (target.data()["properties"].hasOwnProperty('vulnerabilities') && target.data()["properties"]["vulnerabilities"].length >0) {

    let popper = target.popper({
      content: () => {
        // create div container
        let tooltip = document.createElement('div');
        // adding id for easier JavaScript control
        tooltip.id = tooltipId;

        // adding class for easier CSS control
        tooltip.classList.add('target-popper');

        // create actual table


        // append table to div container

        let targetData = target.data()["properties"]["vulnerabilities"];

        // loop through target data
        for (let prop in targetData) {
          let targetValue = targetData[prop];
          let p= document.createElement('p');
          p.innerText = target.data()["properties"]["vulnerabilities"][prop]["analysis_name"]+": "+target.data()["properties"]["vulnerabilities"][prop]["description"];
          tooltip.appendChild(p)
        }

        document.body.appendChild(tooltip);

        return tooltip;
      },
      popper: {
        placement: "auto",
        options:{
          offset:[0,40]
        }
      }
    });

    target.on('position', () => {
      popper.update();
    });

    target.cy().on('pan zoom resize', () => {
      popper.update();
    });


    target.on('mouseover', () => {
      if(!target.hasClass('dimmed')){
        if (document.getElementById(tooltipId)) {
          document.getElementById(tooltipId).classList.add('active');
        }
      }

    }).on('mouseout', () => {
      if (document.getElementById(tooltipId)) {
        document.getElementById(tooltipId).classList.remove('active');
      }
    })
  }

  if (target.data()["properties"].hasOwnProperty('description')) {

    let popper = target.popper({
      content: () => {
        // create div container
        let tooltip = document.createElement('div');

        // adding id for easier JavaScript control
        tooltip.id = tooltipId;

        // adding class for easier CSS control
        tooltip.classList.add('target-popper');

        // create actual table


        // append table to div container

        let desc = target.data()["properties"]["description"];
        // let p = document.createElement('p');
        tooltip.innerText = desc;
        // tooltip.appendChild(p)

        document.body.appendChild(tooltip);

        return tooltip;
      },
      popper: {
        placement: "auto"
      }
    });

    target.on('position', () => {
      popper.update();
    });

    target.cy().on('pan zoom resize', () => {
      popper.update();
    });


    target.on('mouseover', () => {
      if (!target.hasClass('dimmed')) {
        if (document.getElementById(tooltipId)) {
          document.getElementById(tooltipId).classList.add('active');
        }
      }

    }).on('mouseout', () => {
      if (document.getElementById(tooltipId)) {
        document.getElementById(tooltipId).classList.remove('active');
      }
    })
  }
}
