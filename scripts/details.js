function(commandLine){
var batchSize = commandLine.hasOwnProperty('batchSize') ? commandLine['batchSize'] : 10;
var sourceResultSize = commandLine.hasOwnProperty('sourceResultSize') ? commandLine['sourceResultSize'] : 2;
var testName = commandLine.hasOwnProperty('testName') ? commandLine['testName'] : 'default';

var sourceSolrHost = commandLine.hasOwnProperty('sourceSolrHost') ? commandLine['sourceSolrHost'] : CONTEXT.SOLRHOST;
var sourceSolrPort = commandLine.hasOwnProperty('sourceSolrPort') ? commandLine['sourceSolrPort'] : CONTEXT.SOLRPORT;
var sourceSolrCollection = commandLine.hasOwnProperty('sourceSolrCollection') ? commandLine['sourceSolrCollection'] : CONTEXT.SOLRCOLLECTION;
var sourceSolrPath = commandLine.hasOwnProperty('sourceSolrPath') ? commandLine['sourceSolrPath'] : "/api/solr/" + sourceSolrCollection + "/select?wt=json&sort=parentid desc,contenttype desc&rows=" + sourceResultSize;
var sourceHeaderSolrPath = commandLine.hasOwnProperty('sourceHeaderSolrPath') ? commandLine['sourceHeaderSolrPath'] : "/api/solr/" + sourceSolrCollection + "/select?wt=json&rows=1000&q=testname:" + testName;
var sourceSolrIdField = commandLine.hasOwnProperty('sourceSolrIdField') ? commandLine['sourceSolrIdField'] : "id";
var sourceFilterQuery = commandLine.hasOwnProperty('sourceFilterQuery') ? commandLine['sourceFilterQuery'] : "(contenttype:BEFORE OR contenttype:AFTER)";
var sourceHeaderFilterQuery = commandLine.hasOwnProperty('sourceHeaderFilterQuery') ? commandLine['sourceHeaderFilterQuery'] : "(contenttype:JMXQUERYBEFORE OR contenttype:JMXQUERYAFTER)";

var validateSolrHost = commandLine.hasOwnProperty('validateSolrHost') ? commandLine['validateSolrHost'] : CONTEXT.SOLRHOST;
var validateSolrPort = commandLine.hasOwnProperty('validateSolrPort') ? commandLine['validateSolrPort'] : CONTEXT.SOLRPORT;
var validateSolrCollection = commandLine.hasOwnProperty('validateSolrCollection') ? commandLine['validateSolrCollection'] : CONTEXT.SOLRCOLLECTION;
var validateSolrPath = commandLine.hasOwnProperty('validateSolrPath') ? commandLine['validateSolrPath'] : "/api/solr/" + validateSolrCollection + "/select?q=(contenttype:SEARCH+AND+testname:" + testName + ")&wt=json&sort=id+desc&rows=" + batchSize;
var validateSolrUpdatePath = commandLine.hasOwnProperty('validateSolrUpdatePath') ? commandLine['validateSolrUpdatePath'] : "/api/solr/validate/update";
var validateSolrTypeField = commandLine.hasOwnProperty('validateSolrTypeField') ? commandLine['validateSolrTypeField'] : "contenttype";
var validateSolrType = commandLine.hasOwnProperty('validateSolrType') ? commandLine['validateSolrType'] : "SUMMARY";

var missingSentinal = commandLine.hasOwnProperty('missingSentinal') ? commandLine['missingSentinal'] : -1000;

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
        //console.log(res.field);
		//console.log(str);
		
		let data = JSON.parse(str);
		
		if( data.response && data.response.docs ){
                               queryCount = data.response.docs.length;
				ctx.size = data.response.docs.length;
				ctx.docs = data.response.docs;
				ctx.offset = 0;
				let hasMore = data.nextCursorMark && cursorMark != data.nextCursorMark && queryCount == batchSize;
                //console.log(data);
                if( data.nextCursorMark ){
                    if( cursorMark != data.nextCursorMark ){	
                        cursorMark = data.nextCursorMark;
                    }
                    else {
                        console.wslog("complete");
                    }
                }

			/*for(let d in data.response.docs){
				let doc = data.response.docs[d];
				
				validateQuery(doc,data.nextCursorMark && cursorMark != data.nextCursorMark && queryCount == batchSize);
			}*/
                   loopResults.bind({ctx,hasMore})();
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
        }
        loopResults.bind({ctx,hasMore})();
  });
}

function callback(res) {
  let str = "";
  res.on('data', function (chunk) {
              str += chunk;
              
        });

  res.on('end', function () {
        console.wslog("COMMIT");
  });
}

function findMatch(key,otherList){
	let result = -1;
	for(let i = 0;i < otherList.length;i++){
		if( key === otherList[i] ){
			result = i;
			break;
		}
	}

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
        //console.log(res.field);
		let doc = queryDoc;
		//console.log(queryDoc,str);
		queryCount--;
		let data = JSON.parse(str);
		let docDetailList = [];
		
		let newDoc = {"id": validateSolrType + doc.id,"parentid": doc.id,"query_txt": doc["query_txt"],testname: doc["testname"],languageid: doc["languageid"],"channelid": doc["channelid"]};
		newDoc[validateSolrTypeField] = validateSolrType;
		newDoc["rowcount"] = data.response && data.response.numFound ? data.response.numFound : 0;
		
		if( data.response && data.response.numFound > 1 ){
			let beforeRec = data.response.docs[0];
			let afterRec = data.response.docs[1];
			
			newDoc["rowcountbefore"] = beforeRec['rowcount'];
			newDoc["rowcountafter"] = afterRec['rowcount'];
		
			newDoc["qtimeb"] = beforeRec['qtime'];
			newDoc["qtimea"] = afterRec['qtime'];
		        newDoc["qtime"] = beforeRec['qtime']- afterRec['qtime'];
		
			newDoc["rowcountb"] = beforeRec['rowcount'];
			newDoc["rowcounta"] = afterRec['rowcount'];
		        newDoc["rowcount"] = beforeRec['rowcount']- afterRec['rowcount'];
		
			
			let countScore = afterRec["rowcount"] - beforeRec["rowcount"];
	
			let buffer = '';
			
			let beforeList = beforeRec["topdoc"].split(",");
			let afterList = afterRec["topdoc"].split(",");
			
			newDoc["topdocbefore"] = beforeRec['topdoc'];
			newDoc["topdocafter"] = afterRec['topdoc'];
			
			let matchScoreList = [];
			let matchScore = 0;
			for(let i = 0;i < beforeList.length;i++){
				let idx = findMatch(beforeList[i],afterList);
				
				if( idx > -1 ){
					matchScoreList.push(idx - i);
					matchScore += (idx - i);					
				}
				else {
					matchScoreList.push(missingSentinal);
					matchScore += missingSentinal;
				}
			}
			newDoc["matchscore"] = matchScore;
			newDoc["matchscorelist"] = matchScoreList;
			newDoc["differencescore"] = countScore + matchScore;
			newDoc["countscore"] = countScore;
		}
		else {
			newDoc["pscore"] = '0';
		}
		let tCallback = updateCallback.bind({queryDoc: doc,hasMore: hasMore,ctx});
		
		docDetailList.push(newDoc);
		var conf = {hostname: validateSolrHost,port: validateSolrPort,path: validateSolrUpdatePath,method: 'POST',headers: {'Content-Type': 'application/json'}};

                if( CONTEXT.AUTHKEY )
                    conf.headers['Authorization'] = 'Basic ' + CONTEXT.AUTHKEY;

		var t = CONTEXT.lib.https.request(conf, tCallback);
		t.on('error', function(e) {console.log("Got error: " + e.message);});
		t.write(JSON.stringify(docDetailList));
		t.end();
  });
}

function validateQuery(doc,hasMore,ctx){
	let tCallback = queryCallback.bind({queryDoc: doc,hasMore: hasMore,ctx});
	//console.log(doc);
	let tSourceSolrPath = sourceSolrPath + "&fq=" + sourceFilterQuery + "&q=parentid:" + doc["id"];
	//console.log(tSourceSolrPath);
        let conf = {hostname: sourceSolrHost,port: sourceSolrPort,path: encodeURI(tSourceSolrPath),method: 'GET',headers: {'Content-Type': 'application/json'}};
        if( CONTEXT.AUTHKEY )
                    conf.headers['Authorization'] = 'Basic ' + CONTEXT.AUTHKEY;

	let t = CONTEXT.lib.https.request(conf, tCallback);
	t.on('error', function(e) {console.log("Got error: " + e.message);});
	t.end();
}

function loadValidationData(cursorMark,ctx){
    let tCallback = validateCallback.bind({ctx});
	
	let tValidateSolrPath = validateSolrPath + "&cursorMark=" + cursorMark;
	console.log(tValidateSolrPath);
         var conf = {hostname: validateSolrHost,port: validateSolrPort,path: tValidateSolrPath,method: 'GET',headers: {'Content-Type': 'application/json'}};

                if( CONTEXT.AUTHKEY )
                    conf.headers['Authorization'] = 'Basic ' + CONTEXT.AUTHKEY;
	let t = CONTEXT.lib.https.request(conf, tCallback);
	t.on('error', function(e) {console.log("Got error: " + e.message);});
	t.end();
}

function doCommit(){
    if( commandLine.callback ){
        console.log("do complete callback");
        commandLine.callback();
    }
    else {
        var tCallback = callback.bind({});
var tValidateSolrPath = validateSolrUpdatePath + "?commit=true";

var conf = {hostname: validateSolrHost,port: validateSolrPort,path: tValidateSolrPath,method: 'GET',headers: {'Content-Type': 'application/json'}};

                if( CONTEXT.AUTHKEY )
                    conf.headers['Authorization'] = 'Basic ' + CONTEXT.AUTHKEY;
        var t = CONTEXT.lib.https.get(conf, tCallback);
    }
}

loadValidationData(cursorMark,LOOPCTX);

}