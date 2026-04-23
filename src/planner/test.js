const PlannerState = {
  data: {
    'Mat1': { paralelos: { '1': { horarios: ['Lun 10:00-12:00'] } } },
    'Mat2': { paralelos: { '1': { horarios: ['Lun 11:00-13:00'] } } }
  },
  selected: {
    'Mat1': '1',
    'Mat2': '1'
  }
};

function pbMatKeys(d) { return Object.keys(d); }

function pbParseH(arr) {
  return arr.map(a => {
    let parts = a.split(' ');
    let time = parts[1].split('-');
    let sh = time[0].split(':').map(Number);
    let eh = time[1].split(':').map(Number);
    return { di: parts[0], s: sh[0]*60+sh[1], e: eh[0]*60+eh[1] };
  });
}

function pbOverlaps(slotsA, slotsB) {
  for(let a of slotsA) {
    for(let b of slotsB) {
      if(a.di === b.di && a.s < b.e && a.e > b.s) return true;
    }
  }
  return false;
}

function plannerBuildCMap() {
  var mks      = pbMatKeys(PlannerState.data);
  var selSlots = {};

  mks.forEach(function(m) {
    var p = PlannerState.selected[m];
    if (p) {
      selSlots[m] = pbParseH(PlannerState.data[m].paralelos[p].horarios);
    }
  });

  var cmap = {};
  mks.forEach(function(m) {
    var mat = PlannerState.data[m];
    if (!mat || !mat.paralelos) return;
    Object.keys(mat.paralelos).forEach(function(p) {
      var slots    = pbParseH(mat.paralelos[p].horarios);
      var conflict = false;
      Object.keys(selSlots).forEach(function(sm) {
        if (!conflict && sm !== m && pbOverlaps(slots, selSlots[sm])) {
          conflict = true;
        }
      });
      cmap[m + '|' + p] = conflict;
    });
  });

  return cmap;
}

console.log(plannerBuildCMap());
