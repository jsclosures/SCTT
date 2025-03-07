/*
	node ./clonecollection authKey="c29scjpTb2xyUm9ja3M=" debug=11 batchSize=10 sourceSolrCollection=validate destinationSolrCollection=validatecopy 
*/
const http = require('http');
const https = require('https');

const maxStringLength = 1000000000;

console.log("Maximum string length: " + maxStringLength);

const commandLine = {};

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

process.env.NODE_TLS_REJECT_UNAUTHORIZED=0;

commandLine.batchSize = Object.prototype.hasOwnProperty.call(commandLine,'batchSize') ? commandLine['batchSize'] : 10;
commandLine.maxBatchSize = Object.prototype.hasOwnProperty.call(commandLine,'maxBatchSize') ? commandLine['maxBatchSize'] : 2000;
commandLine.sourceSolrIdField = Object.prototype.hasOwnProperty.call(commandLine,'sourceSolrIdField') ? commandLine['sourceSolrIdField'] : "id";
commandLine.sourceSolrQuery = Object.prototype.hasOwnProperty.call(commandLine,'sourceSolrQuery') ? commandLine['sourceSolrQuery'] : "*:*";

commandLine.sourceSolrHost = Object.prototype.hasOwnProperty.call(commandLine,'sourceSolrHost') ? commandLine['sourceSolrHost'] : "localhost";
commandLine.sourceSolrPort = Object.prototype.hasOwnProperty.call(commandLine,'sourceSolrPort') ? commandLine['sourceSolrPort'] : 8983;
commandLine.sourceSolrCollection = Object.prototype.hasOwnProperty.call(commandLine,'sourceSolrCollection') ? commandLine['sourceSolrCollection'] : 'validate';
commandLine.sourceSolrPath = Object.prototype.hasOwnProperty.call(commandLine,'sourceSolrPath') ? commandLine['sourceSolrPath'] : "/solr/" + commandLine.sourceSolrCollection + "/select?wt=json&sort=" + commandLine.sourceSolrIdField + "+asc&q=" + commandLine.sourceSolrQuery;

commandLine.destinationSolrHost = Object.prototype.hasOwnProperty.call(commandLine,'destinationSolrHost') ? commandLine['destinationSolrHost'] : "localhost";
commandLine.destinationSolrPort = Object.prototype.hasOwnProperty.call(commandLine,'destinationSolrPort') ? commandLine['destinationSolrPort'] : 8983;
commandLine.destinationSolrCollection = Object.prototype.hasOwnProperty.call(commandLine,'destinationSolrCollection') ? commandLine['destinationSolrCollection'] : 'validatecopy';
commandLine.destinationSolrUpdatePath = Object.prototype.hasOwnProperty.call(commandLine,'destinationSolrUpdatePath') ? commandLine['destinationSolrUpdatePath'] : "/solr/" + commandLine.destinationSolrCollection + "/update";
commandLine.authKey = Object.prototype.hasOwnProperty.call(commandLine,'authKey') ? commandLine['authKey'] : '';
commandLine.fieldsToExclude = Object.prototype.hasOwnProperty.call(commandLine,'fieldsToExclude') ? commandLine['fieldsToExclude'].split(',') : [];
commandLine.runForever = Object.prototype.hasOwnProperty.call(commandLine,'runForever') ? commandLine['runForever'] === 'true' : false;
commandLine.async = Object.prototype.hasOwnProperty.call(commandLine,'async') ? commandLine['async'] === 'true' : false;
commandLine.sslMode = Object.prototype.hasOwnProperty.call(commandLine,'sslMode') ? commandLine['sslMode'] === 'true' : false;
commandLine.debug = Object.prototype.hasOwnProperty.call(commandLine,'debug') ? commandLine['debug'] : 0;

if( commandLine.debug > 0 ) console.log("commandline",commandLine);

let CONTEXT = {cursorMark:"*",maxStringLength,lastSize: commandLine.batchSize,orignalSize: commandLine.batchSize,commandLine,lib: {http,https}};

let HANDLERS = false;

function inExcludeList(ctx,fieldName){
	let result = false;
        for(let i in ctx.commandLine.fieldsToExclude){
		if( fieldName.indexOf(ctx.commandLine.fieldsToExclude[i]) > -1 ){
			result = true;
			break;
		}
	}

	return( result );
}

function queryCallback(res) {
	let str = "";
	let ctx = this.ctx;
	let failed = false;
	const contentLength = res.headers['content-length'];
	  console.log("Content-Length: " + contentLength);
	  
	  if( contentLength && contentLength > ctx.maxStringLength ){
		console.log("init lastSize was set to " + ctx.lastSize + " reseting and doubling batchsize");
		ctx.lastSize = ctx.commandLine.batchSize;
		ctx.commandLine.batchSize = Math.round(ctx.commandLine.batchSize/2);
		failed = true;
		loadQueryBatch(ctx);
	  }
	  else {
			res.on('data', function (chunk) {
				try{
					str += chunk;
				}catch(e){
					console.log("payload too big so resizing and trying again " + ctx.commandLine.batchSize);
					ctx.lastSize = ctx.commandLine.batchSize;
					ctx.commandLine.batchSize = Math.round(ctx.commandLine.batchSize/2);
					failed = true;
				}     
			});

			res.on('end', function () {
					//console.log(res.field);
					//console.log(str);
					if( failed ){
						loadQueryBatch(ctx);
					}
					else {
						try {
							let data = JSON.parse(str);

							if( ctx.commandLine.batchSize < ctx.commandLine.orignalSize ){
								console.log("lastSize was set to " + ctx.lastSize + " reseting and doubling batchsize");
								ctx.lastSize = ctx.commandLine.batchSize;
								ctx.commandLine.batchSize = ctx.commandLine.orignalSize;
							}
							
							if( data.response && data.response.docs ){
								for(let d in data.response.docs){
									let doc = data.response.docs[d];
									for( let p in doc){
										if( Object.prototype.hasOwnProperty.call(doc,p) ){
											if( p === '_version_' || p === 'score' || inExcludeList(ctx,p) ){
												
												delete doc[p];
											}
										}
									}
									
								}
								
								if( ctx.HANDLERS && ctx.HANDLERS["documents"] )
									ctx.HANDLERS["documents"]({docs: data.response.docs,hasMore: data.nextCursorMark && data.nextCursorMark != ctx.cursorMark});
								else
									copyDocuments(ctx,data.response.docs,data.nextCursorMark && data.nextCursorMark != ctx.cursorMark);
							}
							//console.log(data);
							if( data.nextCursorMark ){
								if( ctx.cursorMark != data.nextCursorMark ){	
									ctx.cursorMark = data.nextCursorMark;
									if( ctx.commandLine.async ) loadQueryBatch(ctx);
								}
								else {
									console.log("complete");
									doCommit(ctx);
								}
							}
						}
						catch(e){
							//failed
							console.log("failed to parse " + e + " " + str);
							setTimeout(loadQueryBatch,60000,ctx);
						}
					}
			});
	  }
}

function updateCallback(res) {
	let str = "";
	let hasMore = this.hasMore;
	let ctx = this.ctx;

  res.on('data', function (chunk) {
              str += chunk;
              
        });

  res.on('end', function () {
        if( ctx.commandLine.debug > 0 ) console.log("UPDATE",hasMore,str);
	if( !ctx.commandLine.async && hasMore ){
		loadQueryBatch(ctx);
	}
  });
}

function commitCallback(res) {
	let str = "";
	let ctx = this.ctx;

  res.on('data', function (chunk) {
              str += chunk;
              
        });

  res.on('end', function () {
        console.log("COMMIT",str);

	if( ctx.commandLine.runForever ){
		ctx.cursorMark = "*";
		loadQueryBatch(ctx);
	}
  });
}

function copyDocuments(ctx,docs,hasMore){
	let tCallback = updateCallback.bind({ctx,hasMore});
	//console.log("hasmore",hasMore);
	let conf = {hostname: ctx.commandLine.destinationSolrHost,port: ctx.commandLine.destinationSolrPort,path: ctx.commandLine.destinationSolrUpdatePath,method: 'POST',headers: {'Content-Type': 'application/json'}}

	if( ctx.commandLine.authKey ){
		conf.headers['Authorization'] = 'Basic ' + ctx.commandLine.authKey;
	}
		
	let t = (ctx.commandLine.sslMode ? ctx.lib.https : ctx.lib.http).request(conf, tCallback);
	t.on('error', function(e) {console.log("Got error: " + e.message);});
	t.write(JSON.stringify(docs));
	t.end();
}

function loadQueryBatch(ctx){
	let tCallback = queryCallback.bind({ctx});
	
	let tSourceSolrPath = ctx.commandLine.sourceSolrPath + "&cursorMark=" + ctx.cursorMark + "&rows=" + ctx.commandLine.batchSize;

	console.log("query: " + tSourceSolrPath);

	let conf = {hostname: ctx.commandLine.sourceSolrHost,port: ctx.commandLine.sourceSolrPort,path: tSourceSolrPath,method: 'GET',headers: {'Content-Type': 'application/json'}};

	if( ctx.commandLine.authKey ){
		conf.headers['Authorization'] = 'Basic ' + ctx.commandLine.authKey;
	}

	let t =  (ctx.commandLine.sslMode ? ctx.lib.https : ctx.lib.http).request(conf, tCallback);
	t.on('error', function(e) {console.log("Got error: " + e.message);});
	t.end();
}

function doCommit(ctx){

	let tCallback = commitCallback.bind({ctx});

	let conf = {host: ctx.commandLine.destinationSolrHost,port: ctx.commandLine.destinationSolrPort,path: ctx.commandLine.destinationSolrUpdatePath + "?commit=true"};

	if( ctx.commandLine.authKey ){
		conf.headers = {};
		conf.headers['Authorization'] = 'Basic ' + ctx.commandLine.authKey;
	}

	let t =  (ctx.commandLine.sslMode ? ctx.lib.https : ctx.lib.http).get(conf, tCallback);
	t.on('error', function(e) {console.log("Got error: " + e.message);});
	t.end();
}



loadQueryBatch(CONTEXT);



