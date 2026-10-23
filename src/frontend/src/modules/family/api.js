import api from '../../services/api';

const base = '/app/family';

export const familyApi = {
  home: () => api.get(base),
  subjects: () => api.get(`${base}/subjects`),
  createTree: (payload) => api.post(`${base}/trees`, payload),
  tree: (id) => api.get(`${base}/trees/${id}`),
  updateTree: (id, payload) => api.put(`${base}/trees/${id}`, payload),
  deleteTree: (id) => api.delete(`${base}/trees/${id}`),
  access: (id) => api.get(`${base}/trees/${id}/access`),
  saveAccess: (id, entries) => api.put(`${base}/trees/${id}/access`, { entries }),
  importInto: (id, data) => api.post(`${base}/trees/${id}/import`, { data }, { timeout: 0 }),
  exportUrl: (id, format) => `/api${base}/trees/${id}/export${format ? `?format=${format}` : ''}`,

  createPerson: (treeId, payload) => api.post(`${base}/trees/${treeId}/persons`, payload),
  updatePerson: (id, payload) => api.put(`${base}/persons/${id}`, payload),
  deletePerson: (id) => api.delete(`${base}/persons/${id}`),
  uploadPhoto: (id, blob, full = null) => {
    const form = new FormData();
    form.append('photo', blob, 'photo.jpg');
    if (full) form.append('full', full, 'full.jpg');
    return api.post(`${base}/persons/${id}/photo`, form, { timeout: 0 });
  },
  deletePhoto: (id) => api.delete(`${base}/persons/${id}/photo`),

  addParent: (treeId, payload) => api.post(`${base}/trees/${treeId}/parents`, payload),
  updateParent: (id, payload) => api.put(`${base}/parents/${id}`, payload),
  removeParent: (id) => api.delete(`${base}/parents/${id}`),
  addUnion: (treeId, payload) => api.post(`${base}/trees/${treeId}/unions`, payload),
  updateUnion: (id, payload) => api.put(`${base}/unions/${id}`, payload),
  removeUnion: (id) => api.delete(`${base}/unions/${id}`),

  setMe: (treeId, personId) => api.put(`${base}/trees/${treeId}/me`, { personId }),
  select: (treeId, filter) => api.post(`${base}/trees/${treeId}/select`, { filter }),
  views: (treeId) => api.get(`${base}/trees/${treeId}/views`),
  createView: (treeId, payload) => api.post(`${base}/trees/${treeId}/views`, payload),
  updateView: (id, payload) => api.put(`${base}/views/${id}`, payload),
  deleteView: (id) => api.delete(`${base}/views/${id}`),
  cloneTree: (treeId, payload) => api.post(`${base}/trees/${treeId}/clone`, payload, { timeout: 0 }),
  cloneLink: (payload) => api.post(`${base}/clone-link`, payload, { timeout: 0 }),
  log: (treeId, params) => api.get(`${base}/trees/${treeId}/log`, { params }),
  suggestions: (treeId, status) => api.get(`${base}/trees/${treeId}/suggestions`, { params: { status } }),
  acceptSuggestion: (id) => api.post(`${base}/suggestions/${id}/accept`),
  rejectSuggestion: (id) => api.post(`${base}/suggestions/${id}/reject`),

  shares: (treeId) => api.get(`${base}/trees/${treeId}/shares`),
  createShare: (treeId, payload) => api.post(`${base}/trees/${treeId}/shares`, payload),
  updateShare: (id, payload) => api.put(`${base}/shares/${id}`, payload),
  deleteShare: (id) => api.delete(`${base}/shares/${id}`),
};

/** Anonymous side: /api/t/<token>. `who` = { unlock, visitor } tokens. */
const visitorHeaders = (who = {}) => ({
  ...(who.unlock ? { 'X-Share-Token': who.unlock } : {}),
  ...(who.visitor ? { 'X-Visitor': who.visitor } : {}),
});
export const publicFamilyApi = {
  tree: (token, who) => api.get(`/t/${token}`, { headers: visitorHeaders(who) }),
  unlock: (token, password) => api.post(`/t/${token}/unlock`, { password }),
  hello: (token, who, payload) => api.post(`/t/${token}/hello`, payload, { headers: visitorHeaders(who) }),
  suggest: (token, who, payload) => api.post(`/t/${token}/suggest`, payload, { headers: visitorHeaders(who) }),
  suggestPhoto: (token, who, personId, blob, author = {}, full = null) => {
    const form = new FormData();
    form.append('authorName', author.name || '');
    form.append('note', author.note || '');
    form.append('photo', blob, 'photo.jpg');
    if (full) form.append('full', full, 'full.jpg');
    return api.post(`/t/${token}/persons/${personId}/photo`, form, { timeout: 0, headers: visitorHeaders(who) });
  },
};

/**
 * Square-crops and downsizes a picture in the browser (max 640 px JPEG), so
 * phone photos of several MB become ~100 KB before they are sent.
 */
/** The whole picture, uncropped, at most `max` px on the long side (for viewing it large). */
export async function prepareFull(file, { max = 2048 } = {}) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = reject;
      image.src = url;
    });
    const scale = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(img.naturalWidth * scale);
    canvas.height = Math.round(img.naturalHeight * scale);
    canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
    return await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.9));
  } catch {
    return null;
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function preparePhoto(file, { size = 640, focus = null } = {}) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = reject;
      image.src = url;
    });
    const side = Math.min(img.naturalWidth, img.naturalHeight);
    const fx = focus ? focus.x : 0.5;
    const fy = focus ? focus.y : 0.4;
    const sx = Math.max(0, Math.min(img.naturalWidth - side, img.naturalWidth * fx - side / 2));
    const sy = Math.max(0, Math.min(img.naturalHeight - side, img.naturalHeight * fy - side / 2));
    const out = Math.min(size, side);
    const canvas = document.createElement('canvas');
    canvas.width = out;
    canvas.height = out;
    canvas.getContext('2d').drawImage(img, sx, sy, side, side, 0, 0, out, out);
    return await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.88));
  } finally {
    URL.revokeObjectURL(url);
  }
}
