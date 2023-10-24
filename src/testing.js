import TfIdf from './tfidf.js'

const tfidfInstance = new TfIdf();
const fetchedData = ["Lysandra was born under the emerald canopy of the Whispering Woods, where every leaf tells a tale and every breeze carries a secret. With hair as dark as the raven's wing and eyes that shimmer like twilight, she commands the spirits of the forest with a gentle hum. Chosen as the guardian of ancient lore, Lysandra roams the woodland paths, ensuring that the stories of old are neither forgotten nor misused.", 
"In a realm beyond the reach of mortals, where stars waltz and galaxies serenade, Seraphel graces the cosmic stage. With a gown spun from moonbeams and a crown of comets, she dances to the rhythm of pulsars. Her ethereal beauty is said to inspire poets on distant planets, and her legend transcends the boundaries of space and time, captivating all who look up at the night sky with hope and wonder.",
"From the bustling towns of the east to the desolate dunes of the west, tales of Brevin's ingenious creations are shared around campfires. A nomad by choice and an inventor by passion, Brevin carries a bag bursting with peculiar gadgets, each with its own unique tale. With a twinkle in his azure eyes and a constantly whirring mind, he finds wonder in the mundane and crafts marvels from mere scraps.","Car engines have evolved significantly over the years, diversifying in design, function, and efficiency to meet various demands. The most common type is the internal combustion engine (ICE), which primarily includes gasoline and diesel engines. Gasoline engines, typically found in most passenger vehicles, utilize spark plugs to ignite the air-fuel mixture, whereas diesel engines rely on compression for ignition, often leading to greater efficiency and torque. There are also rotary engines, like the Wankel, which use a rotor instead of pistons for combustion. With environmental concerns rising, alternative power sources have gained traction. Electric engines, which use electrical energy stored in batteries to drive a motor, have become increasingly popular due to zero tailpipe emissions. Hybrid engines combine traditional ICE with electric motors to enhance efficiency. Then there's the hydrogen fuel cell, which generates electricity on-board by combining hydrogen with oxygen, emitting only water as a byproduct. As technology progresses, the diversity and efficiency of car engines are bound to expand even further."]

const question="who is lysandra"
fetchedData.forEach((document, index) => {
    tfidfInstance.addDocument(document, index);
});
console.log(tfidfInstance)
const scores = [];

tfidfInstance.tfidfs(question, function (i, measure) {
  scores.push({ index: i, score: measure });
});

// console.log(tfidfInstance)
console.log(scores)
const topDocs = scores.sort((a, b) => b.score - a.score).slice(0, 5).map(doc => fetchedData[doc.index]).join(' ');
console.log('Top documents based on TF-IDF:', topDocs);