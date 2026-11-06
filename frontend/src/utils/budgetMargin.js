export function validBudgetMargin(value) {
 return value!==null && value!==undefined && String(value).trim()!=='' && Number.isFinite(Number(value)) && Number(value)>=0 && Number(value)<100;
}
export function marginIndicators({margin,sale,earnedSale,actualCost,estimatedCost,costError=false}) {
 const valid=validBudgetMargin(margin),factor=valid?1-Number(margin)/100:null;
 const amount=v=>v!=null&&v!==''&&Number.isFinite(Number(v))&&Number(v)>=0;
 const costBudget=valid&&amount(sale)?Number(sale)*factor:null;
 const earnedCost=valid&&amount(earnedSale)?Number(earnedSale)*factor:null;
 const costValid=!costError&&amount(actualCost),estimatedValid=!costError&&amount(estimatedCost);
 return {costBudget,earnedCost,cpi:costValid&&actualCost>0&&earnedCost!=null?earnedCost/actualCost:null,
  variance:costValid&&earnedCost!=null?earnedCost-actualCost:null,
  actualMargin:costValid&&earnedSale>0?(1-actualCost/earnedSale)*100:null,
  projectedMargin:estimatedValid&&sale>0?(1-estimatedCost/sale)*100:null,
  projectedVariance:estimatedValid&&costBudget!=null?costBudget-estimatedCost:null};
}
