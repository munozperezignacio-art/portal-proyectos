export function groupFuelByVehicle(rows) {
  const groups = new Map();
  for (const row of rows) {
    const key = JSON.stringify([row.portal, row.vehicle]);
    const group = groups.get(key) || {portal:row.portal, vehicle:row.vehicle, count:0, pending:0, litersMilli:0, debit:0};
    group.count++;
    if (!row.assignment) group.pending++;
    group.litersMilli += Number(row.liters_milli);
    group.debit -= Number(row.amount_signed);
    groups.set(key, group);
  }
  return [...groups.values()].sort((a,b) => b.litersMilli-a.litersMilli);
}
