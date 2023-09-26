function(oCommandLine){
	function extractTest(commandLine){
	var batchSize = commandLine.hasOwnProperty('batchSize') ? commandLine['batchSize'] : 12;
	var sourceResultSize = commandLine.hasOwnProperty('sourceResultSize') ? commandLine['sourceResultSize'] : 12;
	var vehicleId= commandLine.hasOwnProperty('vehicleId') ? commandLine['vehicleId'] : '';
	var sourceMode = commandLine.hasOwnProperty('sourceMode') ? commandLine['sourceMode'] : 'SOLR';
        var testName = commandLine.hasOwnProperty('testName') ? commandLine['testName'] : '';
	var sourceSolrHost = commandLine.hasOwnProperty('sourceSolrHost') ? commandLine['sourceSolrHost'] : CONTEXT.SOLRHOST;
	var sourceSolrPort = commandLine.hasOwnProperty('sourceSolrPort') ? commandLine['sourceSolrPort'] : CONTEXT.SOLRPORT;
	var sourceSolrCollection = commandLine.hasOwnProperty('sourceSolrCollection') ? commandLine['sourceSolrCollection'] : CONTEXT.SOLRCOLLECTION;
	var sourceSolrPath = commandLine.hasOwnProperty('sourceSolrPath') ? commandLine['sourceSolrPath'] : "/api/solr/" + sourceSolrCollection + "/select?fl=*&wt=json&rows=" + sourceResultSize + "&";
	var sourceSolrField = commandLine.hasOwnProperty('sourceSolrField') ? commandLine['sourceSolrField'] : "id";
	var sourceSolrIdField = commandLine.hasOwnProperty('sourceSolrIdField') ? commandLine['sourceSolrIdField'] : "id";

	var validateSolrHost = commandLine.hasOwnProperty('validateSolrHost') ? commandLine['validateSolrHost'] : CONTEXT.SOLRHOST;
	var validateSolrPort = commandLine.hasOwnProperty('validateSolrPort') ? commandLine['validateSolrPort'] : CONTEXT.SOLRPORT;
	var validateSolrPath = commandLine.hasOwnProperty('validateSolrPath') ? commandLine['validateSolrPath'] : "/api/solr/" + CONTEXT.SOLRCOLLECTION + "/select?fq=contenttype:SEARCH&q=(testname:" + testName + ")&wt=json&sort=id+desc&rows=" + batchSize;
	var validateSolrUpdatePath = commandLine.hasOwnProperty('validateSolrUpdatePath') ? commandLine['validateSolrUpdatePath'] : "/api/solr/" + CONTEXT.SOLRCOLLECTION + "/update";
	var validateSolrTypeField = commandLine.hasOwnProperty('validateSolrTypeField') ? commandLine['validateSolrTypeField'] : "contenttype";
	var validateSolrType = commandLine.hasOwnProperty('validateSolrType') ? commandLine['validateSolrType'] : "BEFORE";
	var validateSolrField = commandLine.hasOwnProperty('validateSolrField') ? commandLine['validateSolrField'] : "query_txt";
	var validateSolrIdField = commandLine.hasOwnProperty('validateSolrIdField') ? commandLine['validateSolrIdField'] : "id";
	var includeDetail = commandLine.hasOwnProperty('includeDetail') ? commandLine['includeDetail'] : '';
	var writeMode = commandLine.hasOwnProperty('writeMode') ? commandLine['writeMode'] : 'truncate';
	var cursorMark = "*";
	var queryCount = 0;
		
	let LOOPCTX = {offset: 0,docs: [],size: 0}; 

    function loopResults(){
		let ctx = this.ctx;
		let hasMore = this.hasMore;

		if( ctx.offset < ctx.size ){
			let doc = ctx.docs[ctx.offset++];
			validateQuery(doc,hasMore,ctx);
		}
		else {
			if( hasMore )
				loadValidationData(cursorMark,ctx);
			else
				doCommit();
		}
	}

	function validateCallback(res) {
	  let str = "";
	  let ctx = this.ctx;

	  res.on('data', function (chunk) {
				  str += chunk;
				  
			});

	  res.on('end', function () {
			let data = JSON.parse(str);
			
			if( data.response && data.response.docs ){
				queryCount = data.response.docs.length;
				ctx.size = data.response.docs.length;
				ctx.docs = data.response.docs;
				ctx.offset = 0;
				let hasMore = data.nextCursorMark && cursorMark != data.nextCursorMark && queryCount == batchSize;

				//console.wslog(data);
				if( data.nextCursorMark ){
					if( cursorMark != data.nextCursorMark ){	
						cursorMark = data.nextCursorMark;
					}
					else {
						console.wslog("complete");
					}
				}

				loopResults.bind({ctx,hasMore})();
				/*
				for(let d in data.response.docs){
					let doc = data.response.docs[d];
					
					validateQuery(doc,data.nextCursorMark && cursorMark != data.nextCursorMark && queryCount == batchSize);
				}*/
			}
			
	  });
	}

	function updateCallback(res) {
	  let str = "";
	  let queryDoc = this.queryDoc;
	  let hasMore = this.hasMore;
	  let ctx = this.ctx;

	  res.on('data', function (chunk) {
				  str += chunk;
				  
			});

	  res.on('end', function () {
			console.wslog(queryDoc.id,"UPDATE",str);
			
			console.wslog("checking query count",queryCount);
			if( queryCount <= 0 ) {
				console.wslog("call load sybc",hasMore);
				
				/*if( hasMore )
					loadValidationData(cursorMark);
				else
					doCommit();*/
			}
			loopResults.bind({ctx,hasMore})();
	  });
	}

	function callback(res) {
	  var str = "";
	  res.on('data', function (chunk) {
				  str += chunk;
				  
			});

	  res.on('end', function () {
			console.wslog("COMMIT");
	  });
	}

	function getItemSourceId(doc,fieldStr){
		let result = "";

		let fieldList = fieldStr.split(",");

		for(let fi in fieldList){
			if( fi > 0 )
				result += "::";

			result += doc[fieldList[fi]];
		}

		if( !result )
			result = doc.id;

		return( result );
	}
	 
	function queryCallback(res) {
	  let str = "";
	  let queryDoc = this.queryDoc;
	  let hasMore = this.hasMore;
	  let ctx = this.ctx;

	  res.on('data', function (chunk) {
				  str += chunk;
				   
			});

	  res.on('end', function () {
			//console.wslog(res.field);
			let doc = queryDoc;
			queryCount--;

			

			//console.wslog(res.queryDoc,str);
			
			let data = JSON.parse(str);
			let docDetailList = [];
			
			let newDoc = {  
							id: validateSolrType + doc[validateSolrIdField],
							parentid: doc[validateSolrIdField],
							query_txt: doc[validateSolrField],
							testname: doc["testname"],
							languageid: doc["languageid"],
							channelid: doc["channelid"],
							source: sourceSolrHost + '-' + sourceSolrCollection
						};
						newDoc[validateSolrTypeField] = validateSolrType;

			let docList = false;
			if( sourceMode == 'COVEO' ){
				newDoc["rowcount"] = data.totalCount ? data.totalCount : 0;
				newDoc["qtime"] = data.duration ? data.duration : 0;
				newDoc["status_i"] = data.duration ? data.duration : 0;
				docList = data.results;
			}
			else if( sourceMode == 'AZ' ){
				newDoc["rowcount"] = data.searchResults ? data.searchResults.totalNumberOfRecords : 0;
				newDoc["qtime"] = 1;
				newDoc["status_i"] = 1;
				docList = data?.searchResults?.skuRecords;
			}
			else if( sourceMode == 'AZF' ){
				newDoc["rowcount"] = data.totalCount ? data.totalCount : 0;
				newDoc["qtime"] = data.duration ? data.duration : 0;
				newDoc["status_i"] = data.duration ? data.duration : 0;
				docList = data.results;
			}
			else {
				newDoc["rowcount"] = data.response && data.response.numFound ? data.response.numFound : 0;
				newDoc["qtime"] = data.responseHeader && data.responseHeader.QTime ? data.responseHeader.QTime : 0;
				newDoc["status_i"] = data.responseHeader && data.responseHeader.status ? data.responseHeader.status : 0;
				docList = data.response.docs;
			}

			
			if( docList && docList.length > 0 ){
				let buffer = '';
				
				for(let i = 0;i < docList.length;i++){
					if( i > 0 )
						buffer += "~";
					let sourceFieldTxt = getItemSourceId(docList[i],sourceSolrIdField);

					buffer += sourceFieldTxt;
					
					let newDocDetail = {
										"id": validateSolrType + sourceFieldTxt + i,
										"parentid": sourceFieldTxt,
										"query_txt": doc[validateSolrField],
										testname: doc["testname"],
										languageid: doc["languageid"],
										"channelid": doc["channelid"]
									};
					newDocDetail[validateSolrTypeField] = validateSolrType + "DETAIL";
					newDocDetail["sequence"] = i;
					newDocDetail["docscore"] = docList[i].score;
					if( includeDetail ) docDetailList.push(newDocDetail);
				}
				
				newDoc["topdoc"] = buffer;
			}
			else
				newDoc["topdoc"] = 'none';

			let tCallback = updateCallback.bind({queryDoc: doc,hasMore: hasMore,ctx});
			
			docDetailList.push(newDoc);
			
			let headers = {'Content-Type': 'application/json'};
			if (commandLine.AUTHKEY)
				headers["Authorization"] = "Basic " + commandLine.AUTHKEY;

			var t = CONTEXT.lib.https.request({hostname: validateSolrHost,port: validateSolrPort,path: validateSolrUpdatePath,method: 'POST',headers: headers}, tCallback);
			t.on('error', function(e) {console.wslog("Got error: " + e.message);});
			t.write(JSON.stringify(docDetailList));
			t.end();
			
	  });
	}

	function validateQuery(doc,hasMore,ctx){
		let tCallback = queryCallback.bind({queryDoc: doc,hasMore: hasMore,ctx});
		//console.wslog(doc[validateSolrField]);
		
		if( sourceMode == 'COVEO' ){
			let payload  = {q: doc["query_txt"],pipeline: sourceSolrCollection,sortCriteria: "relevancy",firstResult: 0,numberOfResults: batchSize};
			//console.wslog(tSourceSolrPath);
			let t = CONTEXT.lib.https.request({hostname: sourceSolrHost,port: sourceSolrPort,path: sourceSolrPath,method: 'POST',headers: {'Content-Type': 'application/json'}}, tCallback);
			t.on('error', function(e) {console.wslog("Got error: " + e.message);});
			t.write(JSON.stringify(payload));
			t.end();
		}
		else if( sourceMode == 'AZ' ){
			let payload = {
				"preview": false,
				"country": "USA",
				"customerType": "B2C",
				"salesChannel": "ECOMM",
				"recordsPerPage": batchSize,
				"searchText": doc["query_txt"]
			};
			//let payload  = {"country": "USA","customerType": "B2C","deviceType": "app","ignoreVehicleSpecificProductsCheck": false,"isVehicleSpecific": false,"keywordSearchVisual": false,"pageNumber": 1,"preview": false,"recordsPerPage": batchSize,"salesChannel": "ECOMM","searchText": doc["query_txt"],"storeId": 6029,"vehicleId": vehicleId};
			//console.wslog(tSourceSolrPath);
			let headers = {'Content-Type': 'application/json'};
			let conf = {hostname: sourceSolrHost,port: sourceSolrPort,path: "/v1/products/search",method: 'POST',headers: headers};
			conf.agent =  CONTEXT.lib.https.Agent({keepAlive:true});
			let t = CONTEXT.lib.https.request(conf, tCallback);

			t.on('error', function(e) {
				console.wslog("Got error: " + e.message);
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
		}
		else {
			let tSourceSolrPath  = sourceSolrPath + "q=title_txt:" + doc["query_txt"];
			console.wslog("solr path",tSourceSolrPath);
			let headers = {'Content-Type': 'application/json'};
			if (commandLine.AUTHKEY)
				headers["Authorization"] = "Basic " + commandLine.AUTHKEY;
			let t = CONTEXT.lib.https.request({hostname: sourceSolrHost,port: sourceSolrPort,path: encodeURI(tSourceSolrPath),method: 'GET',headers: headers}, tCallback);
			t.on('error', function(e) {console.wslog("Got error: " + e.message);});
			t.end();
		}         
	}

	function loadValidationData(cursorMark,ctx){
		let tCallback = validateCallback.bind({ctx});
		
		let tValidateSolrPath = validateSolrPath + "&cursorMark=" + cursorMark;
		console.wslog("SEARCHURL",tValidateSolrPath);
		let headers = {'Content-Type': 'application/json'};
			if (commandLine.AUTHKEY)
				headers["Authorization"] = "Basic " + commandLine.AUTHKEY;
		let t = CONTEXT.lib.https.request({hostname: validateSolrHost,port: validateSolrPort,path: tValidateSolrPath,method: 'GET',headers: headers}, tCallback);
		t.on('error', function(e) {console.wslog("Got error: " + e.message);});
		t.end();
	}

	function truncateResults(writeMode,callback){
		if( writeMode == "truncate" ){
			let tCallback = callback.bind({});
			let payload = {"delete": {"query": "contenttype:" + validateSolrType}};
			let tValidateSolrPath = validateSolrUpdatePath + "?commit=true";
			let headers = {'Content-Type': 'application/json'};
			if (commandLine.AUTHKEY)
				headers["Authorization"] = "Basic " + commandLine.AUTHKEY;
			let t = CONTEXT.lib.https.request({hostname: validateSolrHost,port: validateSolrPort,path: tValidateSolrPath,method: 'POST',headers: headers}, tCallback);
			t.on('error', function(e) {console.wslog("Got error: " + e.message);});
			t.write(JSON.stringify(payload));
			t.end();
		}
		else {
			//queruy to get starting key
			callback();
		}
	}

	function doCommit(){

		if( commandLine.callback ){
			console.wslog("do complete callback");
			commandLine.callback();
		}
		else {
			console.wslog("do complete commit");
			var tCallback = callback.bind({});
			var t = http.get({host: validateSolrHost,port: validateSolrPort,path: validateSolrUpdatePath + "?commit=true"}, tCallback);
		}
	}

	function doWork(){
		loadValidationData(cursorMark,LOOPCTX);
	}
	truncateResults(writeMode,doWork);
}



function startWork(oCommandLine){

var doFinally = function(){
			console.wslog("do finally");
	let finalCB = function(){
		console.wslog("finally done");

					if( oCommandLine.callback ) oCommandLine.callback(oCommandLine.resultContext);
	}
	var sourceSolrB = {testName: oCommandLine.testName ? oCommandLine.testName  : "default",
						sourceSolrHost: "",
						sourceSolrIdField: oCommandLine.sourceIdField ? oCommandLine.sourceIdField : "partTypeName,itemDescription",
						sourceMode: "AZ",
						sourceSolrPort: 443,
						sourceSolrCollection: "",
						validateSolrType:"BEFORE",
						AUTHKEY: CONTEXT.AUTHKEY
					};
	for(let a in oCommandLine){
		sourceSolrB[a] = oCommandLine[a];
	}
			sourceSolrB.callback = finalCB;

	extractTest(sourceSolrB);
}

var sourceSolrA = {testName: oCommandLine.testName ? oCommandLine.testName  : "default",
					sourceSolrIdField: oCommandLine.sourceIdField ? oCommandLine.sourceIdField : "partTypeName,itemDescription",
					sourceMode: "AZ",
					sourceSolrHost: "",
					sourceSolrPort: 443,
					sourceSolrCollection: "",
					validateSolrType:"AFTER",
					AUTHKEY: CONTEXT.AUTHKEY
				};
for(let a in oCommandLine){
	sourceSolrA[a] = oCommandLine[a];
}
	sourceSolrA.callback = doFinally;

extractTest(sourceSolrA);


}


startWork(oCommandLine);

}