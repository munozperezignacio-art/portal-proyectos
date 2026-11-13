export function overlaps(ref,from,to){
 if(!ref||!from||!to||from>to)return false;
 let [a,b=a]=ref.split('/');
 if(a.length===7){b=new Date(Date.UTC(+a.slice(0,4),+a.slice(5),0)).toISOString().slice(0,10);a+='-01';}
 return a<=to&&b>=from;
}
