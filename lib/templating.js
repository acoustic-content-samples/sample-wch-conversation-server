
const Handlebars = require('handlebars');

function WchConversationTemplatingV1() {

};

WchConversationTemplatingV1.prototype.parseString = function (watsonData, templateString) {
  return new Promise((resolve, reject) => {
    let template = Handlebars.compile(templateString);
    let result = template(watsonData);
    resolve(result);
  });
}

WchConversationTemplatingV1.prototype.parseJSON = function (watsonData, templateObject) {
  return new Promise((resolve, reject) => {
    if(!templateObject) return resolve(templateObject);
    // console.log('templateObject ', JSON.stringify(templateObject));
    let template = Handlebars.compile(JSON.stringify(templateObject));
    // console.log('watsonData ', JSON.stringify(watsonData, null, 1));
    let result = template({watsonData:watsonData});
    // console.log('result ', result);
    resolve(JSON.parse(result));
  });
}

module.exports = new WchConversationTemplatingV1();