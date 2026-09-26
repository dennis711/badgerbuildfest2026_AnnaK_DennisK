export const user={id:'anna',name:'Anna',avatar:'/public/anna.svg',interests:['Design','Wellness','Sport','Food','Art','Tech']};
// Intent and interests are independent. Future recommendations can consume these
// optional signals without adding inferred people or automatically created events.
export const recommendationProfile={userId:'anna',topics:['design','wellness','yoga','running','food','art','health tech'],defaultMode:'Social',routines:[],availability:[],followedHostIds:[],preferences:{}};
export const demoLocation={lat:43.0773,lng:-89.3892,isDemo:true};
export const connections=[{id:'julia',name:'Julia',visibleTo:['anna']},{id:'sofia',name:'Sofia',visibleTo:['anna']},{id:'ryan',name:'Ryan',visibleTo:['anna']}];
export const hosts=[['run','Madison Run Club'],['design','Monona Design Collective'],['clay','Midwest Clay Studio'],['founder','StartingBlock Madison'],['yoga','Good Space Studio'],['art','Madison Museum of Contemporary Art'],['jazz','The Robin Room'],['tech','UW Health Innovation'],['dinner','The Neighborhood Table'],['pilates','Form & Field']].map(([id,name])=>({id,name,verified:true,rating:4.8}));
export const demoNow=new Date('2026-09-26T08:00:00');
const rows=[
['run','Saturday Morning Run','Sport',26,9,2,43.083,-89.382,'James Madison Park','Morning 5K, lakeside air, and coffee after. Come as you are. All paces welcome.',['julia','ryan'],12,0],
['design','Design After Hours','Design',26,18,3,43.074,-89.39,'Garver Studio Downtown','Good ideas start with a conversation. An easy evening for designers, makers, and curious minds.',['sofia'],18,0],
['clay','Ceramics & Wine','Art',26,15,2,43.079,-89.373,'Midwest Clay Studio','Slow down and make something with your hands. Clay, tools, and a glass of wine included.',['julia'],6,35],
['founder','Founder Breakfast','Tech',27,9,2,43.077,-89.367,'StartingBlock Madison','Coffee, breakfast, and honest conversations about building something new.',['ryan'],10,0],
['yoga','Outdoor Yoga','Wellness',26,10,1,43.071,-89.401,'Brittingham Park','A gentle flow by the water. Bring your mat and leave a little lighter.',['sofia'],null,0],
['art','Gallery Opening','Culture',26,17,3,43.0748,-89.393,'MMoCA · State Street','A new perspective on familiar places. Meet local artists over an evening of contemporary art.',[],null,0],
['jazz','Live Jazz Session','Music',26,21,2,43.083,-89.374,'The Robin Room','An intimate late-night set from Madison’s local jazz scene.',[],null,18],
['tech','Health Tech Meetup','Tech',28,18,2,43.071,-89.41,'Discovery Building','People working toward healthier futures. Short talks, thoughtful conversations, and new connections.',['ryan'],24,0],
['dinner','Community Dinner','Food',27,18,3,43.087,-89.36,'The Neighborhood Table','One long table. Seasonal food. A few new faces. Pull up a chair.',['julia','sofia'],8,25],
['pilates','Pilates Social','Wellness',27,11,2,43.067,-89.397,'Form & Field Studio','A feel-good class followed by coffee around the corner. Beginners very welcome.',[],9,15],
['run','Lakeside Sunday Walk','Outdoor',27,15,2,43.083,-89.382,'James Madison Park','A little fresh air and unhurried conversation along Lake Mendota.',['julia'],null,0],
['design','Open Studio Evening','Design',29,18,2,43.074,-89.39,'Monona Design Collective','Step inside local creative studios and meet the people behind the work.',[],20,0]
];
export const events=rows.map(([hostId,title,interest,day,hour,duration,lat,lng,venue,description,attendees,spots,price],i)=>({id:'event-'+i,hostId,title,interest,start:new Date(2026,8,day,hour).getTime(),end:new Date(2026,8,day,hour+duration).getTime(),lat,lng,venue,description,attendees,spots,price,mode:['design','founder','tech'].includes(hostId)?'Professional':'Social',external:hostId==='jazz',age:hostId==='clay'||hostId==='jazz'?21:null}));
for (const event of events) {
  event.status='published';
  event.requirements=event.hostId==='run'?'All paces welcome · Comfortable running shoes':event.hostId==='yoga'?'All levels · Bring your own mat':null;
  event.cover=event.hostId==='yoga'?{src:'/public/park-cover.svg',alt:'Illustrated lakeside park and walking path'}:null;
}
