

  const https = require("https");
const zlib = require("zlib");

const CONTEXT = {lib: {https,zlib}};
const sourceSolrHost = "www.harcor.com";
const sourceSolrPort = 443;
const query_txt = "radiator";
const batchSize = 12;



function callback(res){
    let str = "";

    res.on('data', function (chunk) {
            str += chunk; 
    });

    res.on('end', function () {
        console.log("from service" + str);
    });

}

process.env["NODE_TLS_REJECT_UNAUTHORIZED"] = 0;

//let payload  = {"country": "USA","customerType": "B2C","deviceType": "app","facet": "brand:duralast","ignoreVehicleSpecificProductsCheck": false,"isVehicleSpecific": false,"keywordSearchVisual": false,"pageNumber": 1,"preview": false,"recordsPerPage": 12,"salesChannel": "ECOMM","searchText": query_txt,"sort": {"sortFieldName": "price","sortOrder": "asc"},"storeId": 3181,"userSegments": "LasVegas SDD Segment","vehicleId": 17120678};
let payload  = {"country": "USA","customerType": "B2C","deviceType": "app","facet": "brand:duralast","ignoreVehicleSpecificProductsCheck": false,"isVehicleSpecific": false,"keywordSearchVisual": false,"pageNumber": 1,"preview": false,"recordsPerPage": 12,"salesChannel": "ECOMM","searchText": query_txt,"sort": {"sortFieldName": "price","sortOrder": "asc"},"storeId": 6029,"vehicleId": 0};
let headers = {'Content-Type': 'application/json'};
let conf = {hostname: "harcor.com",port: 443,path: "/v1/products/search",method: 'POST',headers: headers};
//conf.agent =  CONTEXT.lib.https.Agent({keepAlive:true});
let t = CONTEXT.lib.https.request(conf, callback);

t.on('error', function(e) {
	console.log("Got error: " + e.message);
});
t.on('socket', function (socket) {
	socket.setTimeout(5000);  
	//socket.setEncoding('utf8');
	socket.on('timeout', function() {
		t.abort();
		console.log("timeout");
	});
});

t.write(JSON.stringify(payload));
t.end();