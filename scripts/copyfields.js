/**
 * A script to help write SOLR schema api files for a list of collections.
 * 
 * The script will create a directory for the output based on the configDir variable.
 * 
 * The script will create a sub directory for each collection that will contains a schema.json file.
 * 
 * The script takes command line arguments and will look also in the system properties to find a value for required variables.
 * 
 *  Variables and Defaults
 * 
    sourceHost = "solrhost";
	sourcePort = 443;
	sourcePath = "";
	sourceKey = "YWRtaW46U29sclJvY2tz=";
	collections =  ["collection1"];
	configDir = './configs';
	dryRun = false;
	debug = 3;
 * 
 * 
 */

const commandLine = {https: true};

if( process.env ){
	let env = process.env;
	
	for(let e in env){
		commandLine[e] = env[e];
	}
}

process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = 0;

process.argv.forEach((val, index) => {
  console.log(`${index}: ${val}`);
  if( index > 1 ){
	let v = val;
	
	if( v.indexOf("=") ){
		let name = v.substring(0,v.indexOf("="));
		commandLine[name] = v.substring(v.indexOf("=")+1);
		if( commandLine[name].endsWith("'") && commandLine[name].startsWith("'") )
			commandLine[name] = commandLine[name].substring(1,commandLine[name].length-2);
	}
  }
});



console.log("commandline",commandLine);

const https = require('https');
const fs = require('fs');
	
commandLine.sourceHost = commandLine.hasOwnProperty('sourceHost') ? commandLine['sourceHost'] : "solrhost";
commandLine.sourcePort = commandLine.hasOwnProperty('sourcePort') ? commandLine['sourcePort'] : 443;
commandLine.sourcePath = commandLine.hasOwnProperty('sourcePath') ? commandLine['sourcePath'] : "";
commandLine.sourceKey = commandLine.hasOwnProperty('sourceKey') ? commandLine['sourceKey'] : "YWRtaW46RzBQYXJrZXIxMjM=";
commandLine.collections = commandLine.hasOwnProperty('collections') ? commandLine['collections'].split(",") : ["collection1"];
commandLine.configDir = commandLine.hasOwnProperty('configDir') ? commandLine['configDir'] :  './configs';
commandLine.dryRun = commandLine.hasOwnProperty('dryRun') ? commandLine['dryRun'] == "true" : false;

commandLine.debug = commandLine.hasOwnProperty('debug') ? parseInt(commandLine['debug']): 5;

if( commandLine.dryRun ){
	console.log(commandLine);
	process.exit(0);
}

function writeLog(level,message){
	if( level <= this.ctx.commandLine.debug ){
		console.log(message);
	}
}

const CONTEXT = {commandLine,stats: {filesWritten: 0},lib: {https,fs}};

CONTEXT.lib.writeLog = writeLog.bind({ctx: CONTEXT});

function RESTCallback(res) {
  let str = "";
  let ctx = this.ctx;
  let commandLine = ctx.commandLine;
  let callback = this.callback;
  let statusCode = res.statusCode;
  
  res.on('data', function (chunk) {
              str += chunk;   
        });

  res.on('end', function () {
		if( commandLine.debug > 10 ) console.log("callback",str);
		if( callback ){
			callback(str,statusCode);
		}
  });
}

function makeRESTCall(args){
	args.ctx.lib.writeLog(8,args);
	
	let callback = RESTCallback.bind({ctx: args.ctx,callback: args.callback});
	
	let t = args.ctx.lib.https.request({hostname: args.host,port: args.port,path: args.path,method: args.method,headers: {'Authorization': "Basic " + args.authKey,'Content-Type': args.contentType}}, callback);
	t.on('error', function(e) {
		args.ctx.lib.writeLog(1,"Got error: " + e);
	});
	if( args.payload ){
		t.write(args.payload);
	}
		
	t.end();
}

function createSchemaFiles(args){
	let ctx = args.ctx;
	let commandLine = ctx.commandLine;
	let callback = args.callback;
	
	let getSchemaCB = function(res){
		let ctx = this.ctx;
		let callback = this.callback;
		let loopCtx = this.loopCtx;
		let collection = this.collection;
		
		loopCtx.offset++;
		//console.log(res);
		if( !ctx.lib.fs.existsSync(ctx.commandLine.configDir) ){
			ctx.lib.fs.mkdirSync(ctx.commandLine.configDir );
		}
		
		if( !ctx.lib.fs.existsSync(ctx.commandLine.configDir + "/" + collection) ){
			ctx.lib.fs.mkdirSync(ctx.commandLine.configDir + "/" + collection);
		}
		
		ctx.stats.filesWritten++;
		
		let data = '{';
		
		try {
			let schema = JSON.parse(res).schema;
			let counter = 0;
			if( schema.fieldTypes ){
				for(let type of schema.fieldTypes){
					if( counter++ > 0 ){
						data += ',';
					}
					
					data += '\n"add-field-type": ' + JSON.stringify(type,null,5);
				}
			}
			
			if( schema.fields ){
				for(let field of schema.fields){
					if( counter++ > 0 ){
						data += ',';
					}
					
					data += '\n"add-field": ' + JSON.stringify(field,null,5);
				}
			}
			
			if( schema.copyFields ){
				for(let field of schema.copyFields){
					if( counter++ > 0 ){
						data += ',';
					}
					
					data += '\n"add-copy-field": ' + JSON.stringify(field,null,5);
				}
			}
			
		}
		catch(e){
			data += '\n"error": "' + JSON.stringify(e,null,5);
			ctx.lib.writeLog(1,"exception " + e);
		}
		
		data += '\n}';
	
	    ctx.lib.fs.writeFileSync(ctx.commandLine.configDir + "/" + collection + "/schema.json",data);
		
		if( loopCtx.offset >= loopCtx.data.length ){
			callback(res);
		}
	}
	let loopCtx = {offset: 0,count: 0,data: ctx.commandLine.collections };
	
	for(let collection of ctx.commandLine.collections){				
		makeRESTCall({  
			ctx,
			host: ctx.commandLine.sourceHost,
			port: ctx.commandLine.sourcePort,
			path: "/api/solr/" + collection + "/schema",
			method: "GET",
			contentType: "application/json",
			authKey: ctx.commandLine.sourceKey,
			callback: getSchemaCB.bind({ctx,collection,loopCtx,callback}),
		});
	}
}

function doWork(ctx){
	let commandLine = ctx.commandLine;
	//build app
	let callback = function(res){
		let ctx = this.ctx;

		ctx.lib.writeLog(1,"done " + JSON.stringify(ctx.stats));
	}.bind({ctx});
	
	createSchemaFiles({ctx,callback});
}

doWork(CONTEXT);

