import L from 'leaflet';

export const shopIcon = (emoji: string, opts: { closed?: boolean; selected?: boolean } = {}) =>
  L.divIcon({
    className: 'leaflet-div-icon',
    html: `<div class="marker-shop ${opts.closed ? 'closed' : ''} ${opts.selected ? 'selected' : ''}"><span>${emoji}</span></div>`,
    iconSize: [40, 40],
    iconAnchor: [20, 40],
    popupAnchor: [0, -40],
  });

export const homeIcon = L.divIcon({ className: 'leaflet-div-icon', html: '<div class="marker-home">🏠</div>', iconSize: [34, 34], iconAnchor: [17, 17], popupAnchor: [0, -18] });
export const runnerIcon = (emoji = '🛵') => L.divIcon({ className: 'leaflet-div-icon', html: `<div class="marker-runner">${emoji}</div>`, iconSize: [40, 40], iconAnchor: [20, 20], popupAnchor: [0, -20] });
export const meIcon = L.divIcon({ className: 'leaflet-div-icon', html: '<div class="marker-me"></div>', iconSize: [18, 18], iconAnchor: [9, 9] });
export const pinIcon = L.divIcon({
  className: 'leaflet-div-icon',
  html: `<svg width="36" height="46" viewBox="0 0 36 46" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M18 45C18 45 34 27.5 34 17A16 16 0 0 0 2 17C2 27.5 18 45 18 45Z" fill="#16a34a" stroke="white" stroke-width="3"/><circle cx="18" cy="17" r="6" fill="white"/></svg>`,
  iconSize: [36, 46],
  iconAnchor: [18, 46],
});
