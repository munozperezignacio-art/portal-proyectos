function matrix(field) {
  if (field.type !== 'radio' || !field.options?.length) return null;
  const key = field.matrixId || /^rg\d+_\d+(?=_\d+$)/.exec(String(field.id))?.[0];
  const split = String(field.label).indexOf(' · ');
  if (!key || split < 0) return null;
  return {key,title:field.label.slice(0,split),question:field.label.slice(split+3)};
}
export function groupQuestions(fields) {
  const groups=[];
  fields.forEach((field,index)=>{
    const info=matrix(field), last=groups.at(-1);
    if (!info) { groups.push({field,index}); return; }
    if (last?.key===info.key && last.title===info.title && JSON.stringify(last.field.options)===JSON.stringify(field.options)) {
      last.rows.push({field,question:info.question});
    } else groups.push({...info,field,index,rows:[{field,question:info.question}]});
  });
  return groups;
}
