function calcOrderTotal(items) {
return items.reduce((sum, i) => sum + (Number(i.price) * Number(i.quantity)), 0);
}
module.exports = { calcOrderTotal };