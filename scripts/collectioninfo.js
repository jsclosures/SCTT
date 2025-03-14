/*
	node ./clonecollection authKey="c29scjpTb2xyUm9ja3M=" debug=11 batchSize=10 sourceSolrCollection=validate destinationSolrCollection=validatecopy 
*/
const http = require('http');
const https = require('https');

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

commandLine.sourceSolrHost = Object.prototype.hasOwnProperty.call(commandLine,'sourceSolrHost') ? commandLine['sourceSolrHost'] : "localhost";
commandLine.sourceSolrPort = Object.prototype.hasOwnProperty.call(commandLine,'sourceSolrPort') ? commandLine['sourceSolrPort'] : 8983;
commandLine.sourceSolrCollection = Object.prototype.hasOwnProperty.call(commandLine,'sourceSolrCollection') ? commandLine['sourceSolrCollection'] : 'validate';
commandLine.sourceSolrPath = Object.prototype.hasOwnProperty.call(commandLine,'sourceSolrPath') ? commandLine['sourceSolrPath'] : "/solr/" + commandLine.sourceSolrCollection + "/admin/luke?wt=json";

commandLine.authKey = Object.prototype.hasOwnProperty.call(commandLine,'authKey') ? commandLine['authKey'] : '';
commandLine.sslMode = Object.prototype.hasOwnProperty.call(commandLine,'sslMode') ? commandLine['sslMode'] === 'true' : false;
commandLine.debug = Object.prototype.hasOwnProperty.call(commandLine,'debug') ? commandLine['debug'] : 0;

if( commandLine.debug > 0 ) console.log("commandline",commandLine);

let CONTEXT = {commandLine,lib: {http,https}};

let HANDLERS = false;

function queryCallback(res) {
	let str = "";
	let ctx = this.ctx;

	let contentLength = res.headers['Content-Length'];
	if(!contentLength )
		contentLength = res.headers['content-length'];
	
    console.log("Content-Length: " + contentLength);
    
    res.on('data', function (chunk) {
        try{
            str += chunk;
        }catch(e){
            console.log("payload too big " + " exp: " + e + " size: " + str.length);
        }    
    });

    res.on('end', function () {
            try {
                let data = JSON.parse(str);
                //console.log(str);
                if( data.fields ){
                    let fieldList = [];
                    for(let fieldName in data.fields){
                        let field = data.fields[fieldName];
                        field.name = fieldName;
                        fieldList.push(field);
                    }
                    
                    if( ctx.HANDLERS && ctx.HANDLERS["field"] )
                        ctx.HANDLERS["field"]({docs: fieldList});
                    else {
                        let buffer = "name,type,count";

                        for(let i in fieldList){
                            let field = fieldList[i];
                            buffer += "\n" + field.name + "," + field.type + "," + field.docs;
                        }

                        console.log(buffer);
                    }
                }

            }
            catch(e){
                //failed
                console.log("failed to parse " + e + " " + str);
            }
    });
}

function failedHttpRequest(e){
	console.log("Got error: " + e.message);

	setTimeout(loadQuery,this.ctx.commandLine.retryTimeout,this.ctx);
}

function loadQuery(ctx){
	let tCallback = queryCallback.bind({ctx});
	
	let tSourceSolrPath = ctx.commandLine.sourceSolrPath;

	console.log("query: " + tSourceSolrPath);

	let conf = {hostname: ctx.commandLine.sourceSolrHost,port: ctx.commandLine.sourceSolrPort,path: tSourceSolrPath,method: 'GET',headers: {'Content-Type': 'application/json'}};

	if( ctx.commandLine.authKey ){
		conf.headers['Authorization'] = 'Basic ' + ctx.commandLine.authKey;
	}

	let t =  (ctx.commandLine.sslMode ? ctx.lib.https : ctx.lib.http).request(conf, tCallback);
	t.on('error', failedHttpRequest.bind({ctx}));
	t.end();
}

loadQuery(CONTEXT);



