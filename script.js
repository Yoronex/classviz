document.addEventListener('DOMContentLoaded', function () { // on dom ready

  function prepareEles(eles) {

    eles.nodes.forEach((node) => {
      const kind = node.data.properties.kind
      const annot = ["interface","abstract","enum"].includes(kind)
          ? `«${kind}»\n`
          : '';
      if (kind === "package") {
        node.data.name = node.data.id;
        node.data.label = node.data.name;
      } else {
        node.data.name = node.data.properties.simpleName;
        node.data.label = `${annot}${node.data.name}`;
      }
    });

    eles.edges.forEach((edge) => {
      edge.data.interaction = edge.data.labels.join();
      delete edge.data.id;
    });

    return eles;
  }

  function setParents(relationship, inverted) {
    if (inverted) {
      cy.edges(`[interaction = "${relationship}"]`).forEach(edge => {
        edge.source().move({ parent: edge.target().id() });
      });
    } else {
    cy.edges(`[interaction = "${relationship}"]`).forEach(edge => {
        edge.target().move({ parent: edge.source().id()});
      });
    }
    cy.edges(`[interaction = "${relationship}"]`).style({ display: "none" });
  }

  const filePrefix = (new URLSearchParams(window.location.search)).get('prefix')
  const eles = fetch('data/'+(filePrefix?filePrefix:'')+'input.json')
      .then(res => res.json())
      .then(json => json.elements)
      .then(eles => prepareEles(eles))

  const style = fetch('style.cycss')
      .then(res => res.text());

  Promise.all([eles, style])
      .then(initCy);

  function initCy(payload) {

    const cy = window.cy = cytoscape({

      container: document.getElementById('cy'),

      elements: {
        nodes: payload[0].nodes,
        edges: payload[0].edges
      },

      style: payload[1],

      layout: {
        name: 'klay',
        directed: true,
        nodeSpacing: function (node) {
          return 32;
        },
        flow: { axis: 'y', minSeparation: -32 },
        edgeSymDiffLength: 8,

        /* for 'klay'
        direction: 'DOWN',
        // fixedAlignment: 'LEFTUP',
        inLayerSpacingFactor: 0.5, */
      },

      wheelSensitivity: 0.25,
    });

    setParents("contains", false);

    const checkboxes = document.querySelectorAll('input[name="showrels"]');
    checkboxes.forEach((checkbox) => {
      setVisible(checkbox);
    });

    constraints = [];

    // place subpackages below their parent packages
    payload[0].edges
      .filter((e) => [].includes(e.data.interaction))
      .forEach((e) => {
        c = {
          "axis": "y",
          "left": cy.$id(e.data.target),
          "right": cy.$id(e.data.source),
          "gap": 128
        };
        constraints.push(c);
      });

    // place subclasses below their superclasses
    payload[0].edges
      .filter((e) => ["specializes", "realizes"].includes(e.data.interaction))
      .forEach((e) => {
        let c = {
          "axis": "y",
          "left": cy.$id(e.data.target),
          "right": cy.$id(e.data.source),
          "gap": 128
        };
        constraints.push(c);
      });

    // place dependants to the left of the dependency
    payload[0].edges
      .filter((e) => !["specializes", "realizes", "contains"]
        .includes(e.data.interaction))
      .forEach((e) => {
        let c = {
          "axis": "x",
          "left": cy.$id(e.data.source),
          "right": cy.$id(e.data.target),
          "gap": 128
        };
        constraints.push(c);
      });

    // console.log(constraints);

    bindRouters();

    cy.layout({
      name: 'klay', animate: true,
      directed: true,
      nodeSpacing: function (node) {
        return 32;
      },
      flow: { axis: 'y', minSeparation: -32 },
      edgeSymDiffLength: 8,
      gapInequalities: constraints
    }).run();

    return cy;
  }

  // const layoutConfig = {
  //     name: "cola",
  //     handleDisconnected: true,
  //     animate: true,
  //     avoidOverlap: false,
  //     infinite: false,
  //     unconstrIter: 1,
  //     userConstIter: 0,
  //     allConstIter: 1,
  //     ready: e => {
  //         e.cy.fit()
  //         e.cy.center()
  //     }
  // }


  // let nodeid = 1;

  function bindRouters() {

    // right click dims the element
    cy.on('cxttap', 'node,edge',
      evt => evt.target.addClass("dimmed"));

    // left click highlights the node and its connected edges and nodes
    cy.on('tap', 'node', evt => {

      // currently visible relationship types
      const interactions = Array.from(document
        .querySelectorAll('input[name="showrels"]'))
        .filter(cb => cb.checked).map(cb => cb.value);

      const edges = evt.target.connectedEdges()
        .filter(e => interactions.includes(e.data('interaction')));
      console.log(interactions)
      console.log(edges)
      edges.removeClass("dimmed");
      edges.connectedNodes().removeClass("dimmed");

    });

    // left click highlights the edge and its connected nodes
    cy.on('tap', 'edge', evt => {

      evt.target.removeClass("dimmed");
      evt.target.connectedNodes().removeClass("dimmed");

    });

  }

}); // on dom ready


const saveAsSvg = function (filename) {
  const svgContent = cy.svg({ scale: 1, full: true, bg: 'beige' });
  const blob = new Blob([svgContent],
    { type: "image/svg+xml;charset=utf-8" });
  saveAs(blob, filename);
};

const getSvgUrl = function () {
  const svgContent = cy.svg({ scale: 1, full: true, bg: 'beige' });
  const blob = new Blob([svgContent],
    { type: "image/svg+xml;charset=utf-8" });
  return URL.createObjectURL(blob);
};

const setVisible = function (ele) {
  cy.edges('[interaction = "' + ele.value + '"]')
    .toggleClass("hidden", !ele.checked);
};

const setLineBends = function (ele) {
  // console.log(ele.name);
  if (ele.checked) {
    cy.edges('[interaction = "' + ele.name + '"]')
      .style("curve-style", ele.value);
  }
};

const relayout = function (layout) {
  // console.log(layout);
  cy.layout({
    name: layout, animate: true,
    directed: true,
    nodeSpacing: function (node) {
      return 32;
    },
    flow: { axis: 'y', minSeparation: -32 },
    edgeSymDiffLength: 8,
    gapInequalities: constraints
  }).run();
};

const highlight = function (text) {
  if (text) {
    const classes = text.split(/[,\s]+/);
    // console.log(classes);
    cy.elements().addClass("dimmed");
    cy.elements('.hidden').removeClass('hidden').addClass("hidden");

    const cy_classes = cy.nodes()
      .filter(function (node) {
          return classes.includes(node.data('name'));
        });
    const cy_edges = cy_classes.edgesWith(cy_classes);
    cy_classes.removeClass("dimmed");
    cy_edges.removeClass("dimmed");
    cy.nodes('[properties.kind = "package"]').removeClass("dimmed");
  } else {
    cy.elements().removeClass("dimmed");
  }
};

flip = true;
const toggleVisibility = function () {
  cy.style().selector('.dimmed')
    .style({
      'display': flip ? 'none' : 'element'
    })
    .update();
  flip = !flip;
};