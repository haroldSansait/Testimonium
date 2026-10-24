let resolveInitial;
let initial = true;
const initialResult = new Promise(resolve => { resolveInitial = resolve; });
let response = [];
window.fixture = {
  calls: 0, reads: [],
  initial: items => { initial = false; response = items; resolveInitial(items); },
  respond: items => { response = items; },
};
export default { notification: {
  getNotifications() {
    window.fixture.calls++;
    if (initial) {
      return initialResult;
    }
    return Promise.resolve(response.map(item => ({ ...item })));
  },
  async markAsRead(id) {
    window.fixture.reads.push(id);
    response = response.map(item => item.id === id ? { ...item, read: true } : item);
  },
  async markAllAsRead() {
    window.fixture.reads.push('all');
    response = response.map(item => ({ ...item, read: true }));
  },
} };
