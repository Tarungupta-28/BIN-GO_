/* ═══════════════════════════════════════════════════════
   state.js — Global application state
═══════════════════════════════════════════════════════ */
'use strict';

const State = {
  currentUser:  null,
  reports:      [],
  users:        [],
  page:         'dashboard',
  dark:         localStorage.getItem('cc-dark') === '1',

  // Google Map instances
  gmap:         null,
  gmapMarkers:  [],
  gmapHeat:     null,
  gmapInfo:     null,
  miniMap:      null,

  // Report page ephemeral
  imgData:      null,
  gpsCoords:    { lat: 21.1904, lng: 81.2849 },
  selWaste:     '',
};
