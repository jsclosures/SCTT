/*
	node ./clonecollection authKey="c29scjpTb2xyUm9ja3M=" debug=11 batchSize=10 sourceSolrCollection=validate destinationSolrCollection=validatecopy 
*/
var http = require('http');

var commandLine = {};

process.argv.forEach((val, index) => {
  console.log(`${index}: ${val}`);
  if( index > 1 ){
	let v = val;
	
	if( v.indexOf("=") ){
		let name = v.substring(0,v.indexOf("="));
		commandLine[name] = v.substring(v.indexOf("=")+1);
	}
  }
});



var batchSize = Object.prototype.hasOwnProperty.call(commandLine,'batchSize') ? commandLine['batchSize'] : 10;
var sourceSolrIdField = Object.prototype.hasOwnProperty.call(commandLine,'sourceSolrIdField') ? commandLine['sourceSolrIdField'] : "id";
var sourceSolrQuery = Object.prototype.hasOwnProperty.call(commandLine,'sourceSolrQuery') ? commandLine['sourceSolrQuery'] : "*:*";

var sourceSolrHost = Object.prototype.hasOwnProperty.call(commandLine,'sourceSolrHost') ? commandLine['sourceSolrHost'] : "localhost";
var sourceSolrPort = Object.prototype.hasOwnProperty.call(commandLine,'sourceSolrPort') ? commandLine['sourceSolrPort'] : 8983;
var sourceSolrCollection = Object.prototype.hasOwnProperty.call(commandLine,'sourceSolrCollection') ? commandLine['sourceSolrCollection'] : 'validate';
var sourceSolrPath = Object.prototype.hasOwnProperty.call(commandLine,'sourceSolrPath') ? commandLine['sourceSolrPath'] : "/solr/" + sourceSolrCollection + "/select?wt=json&sort=" + sourceSolrIdField + "+asc&rows=" + batchSize + "&q=" + sourceSolrQuery;

var destinationSolrHost = Object.prototype.hasOwnProperty.call(commandLine,'destinationSolrHost') ? commandLine['destinationSolrHost'] : "localhost";
var destinationSolrPort = Object.prototype.hasOwnProperty.call(commandLine,'destinationSolrPort') ? commandLine['destinationSolrPort'] : 8983;
var destinationSolrCollection = Object.prototype.hasOwnProperty.call(commandLine,'destinationSolrCollection') ? commandLine['destinationSolrCollection'] : 'validate20';
var destinationSolrUpdatePath = Object.prototype.hasOwnProperty.call(commandLine,'destinationSolrUpdatePath') ? commandLine['destinationSolrUpdatePath'] : "/solr/" + destinationSolrCollection + "/update";
var authKey = Object.prototype.hasOwnProperty.call(commandLine,'authKey') ? commandLine['authKey'] : '';
var fieldsToExclude = Object.prototype.hasOwnProperty.call(commandLine,'fieldsToExclude') ? commandLine['fieldsToExclude'].split(',') : [];
var runForever = Object.prototype.hasOwnProperty.call(commandLine,'runForever') ? commandLine['runForever'] === 'true' : false;
var async = Object.prototype.hasOwnProperty.call(commandLine,'async') ? commandLine['async'] === 'true' : false;
var debug = Object.prototype.hasOwnProperty.call(commandLine,'debug') ? commandLine['debug'] : 0;

if( debug > 0 ) console.log("commandline",commandLine);

var cursorMark = "*";
var HANDLERS = false;

function inExcludeList(fieldName){
	let result = false;
        for(let i in fieldsToExclude){
		if( fieldName.indexOf(fieldsToExclude[i]) > -1 ){
			result = true;
			break;
		}
	}

	return( result );
}

function queryCallback(res) {
  var str = "";
  
  res.on('data', function (chunk) {
              str += chunk;
              
        });

  res.on('end', function () {
        //console.log(res.field);
		//console.log(str);
		
		let data = JSON.parse(str);
		
		if( data.response && data.response.docs ){
			for(let d in data.response.docs){
				let doc = data.response.docs[d];
				for( let p in doc){
					if( Object.prototype.hasOwnProperty.call(doc,p) ){
						if( p === '_version_' || p === 'score' || inExcludeList(p) ){
							
							delete doc[p];
						}
					}
				}
				
			}
			
			if( HANDLERS && HANDLERS["documents"] )
				HANDLERS["documents"]({docs: data.response.docs,hasMore: data.nextCursorMark && data.nextCursorMark != cursorMark});
			else
				copyDocuments(data.response.docs,data.nextCursorMark && data.nextCursorMark != cursorMark);
		}
		//console.log(data);
		if( data.nextCursorMark ){
			if( cursorMark != data.nextCursorMark ){	
				cursorMark = data.nextCursorMark;
				if( async ) loadQueryBatch(cursorMark);
			}
			else {
				console.log("complete");
				doCommit();
			}
		}
  });
}

function updateCallback(res) {
  var str = "";
  var hasMore = this.hasMore;

  res.on('data', function (chunk) {
              str += chunk;
              
        });

  res.on('end', function () {
        if( debug > 0 ) console.log("UPDATE",hasMore,str);
	if( !async && hasMore ){
		loadQueryBatch(cursorMark);
	}
  });
}

function commitCallback(res) {
  var str = "";
  res.on('data', function (chunk) {
              str += chunk;
              
        });

  res.on('end', function () {
        console.log("COMMIT",str);

	if( runForever ){
		cursorMark = "*";
		loadQueryBatch(cursorMark);
	}
  });
}

function copyDocuments(docs,hasMore){
	let tCallback = updateCallback.bind({hasMore: hasMore});
	//console.log("hasmore",hasMore);
	let conf = {hostname: destinationSolrHost,port: destinationSolrPort,path: destinationSolrUpdatePath,method: 'POST',headers: {'Content-Type': 'application/json'}}

	if( authKey ){
		conf.headers['Authorization'] = 'Basic ' + authKey;
	}
		
	var t = http.request(conf, tCallback);
	t.on('error', function(e) {console.log("Got error: " + e.message);});
	t.write(JSON.stringify(docs));
	t.end();
}

function loadQueryBatch(cursorMark){
	let tCallback = queryCallback.bind({});
	
	let tSourceSolrPath = sourceSolrPath + "&cursorMark=" + cursorMark;
	let conf = {hostname: sourceSolrHost,port: sourceSolrPort,path: tSourceSolrPath,method: 'GET',headers: {'Content-Type': 'application/json'}};

	if( authKey ){
		conf.headers['Authorization'] = 'Basic ' + authKey;
	}

	let t = http.request(conf, tCallback);
	t.on('error', function(e) {console.log("Got error: " + e.message);});
	t.end();
}

function doCommit(){

	var tCallback = commitCallback.bind({});

	let conf = {host: destinationSolrHost,port: destinationSolrPort,path: destinationSolrUpdatePath + "?stream.body=<commit/>"};

	if( authKey ){
		conf.headers = {};
		conf.headers['Authorization'] = 'Basic ' + authKey;
	}

	var t = http.get(conf, tCallback);
	t.on('error', function(e) {console.log("Got error: " + e.message);});
	t.end();
}

loadQueryBatch(cursorMark);



