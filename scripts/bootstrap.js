/**
 * A script to help setup a fusion install.
 * 
 * The script will create an "app"  it is not already created.
 * 
 * The script takes command line arguments and will look also in the system properties to find a value for required variables.
 * 
 *  Variables and Defaults
 * 
    sourceHost = "solrhost";
	sourcePort = 443;
	sourcePath = "/api/";
	sourceKey = "YWRtaW46U29sclJvY2tz=";
	collections =  ["collection1"];
	appName = "default";
	configDir = './configs';
	dryRun = false;
	replicationFactor = 3;
	numShards = 1;
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
commandLine.sourcePath = commandLine.hasOwnProperty('sourcePath') ? commandLine['sourcePath'] : "/api/";
commandLine.sourceKey = commandLine.hasOwnProperty('sourceKey') ? commandLine['sourceKey'] : "YWRtaW46U29sclJvY2tz=";
commandLine.collections = commandLine.hasOwnProperty('collections') ? commandLine['collections'].split(",") : ["collection1"];
commandLine.appName = commandLine.hasOwnProperty('appName') ? commandLine['appName'] : "default";
commandLine.configDir = commandLine.hasOwnProperty('configDir') ? commandLine['configDir'] :  './configs';
commandLine.dryRun = commandLine.hasOwnProperty('dryRun') ? commandLine['dryRun'] == "true" : false;
commandLine.replicationFactor = commandLine.hasOwnProperty('replicationFactor') ? parseInt(commandLine['replicationFactor']): 3;
commandLine.numShards = commandLine.hasOwnProperty('numShards') ? parseInt(commandLine['numShards']): 1;

commandLine.debug = commandLine.hasOwnProperty('debug') ? parseInt(commandLine['debug']): 3;

//add the main app collection to list of collections.
commandLine.collections.push(commandLine.appName);

if( commandLine.dryRun ){
	console.log(commandLine);
	process.exit(0);
}

function writeLog(level,message){
	if( level <= this.ctx.commandLine.debug ){
		console.log(message);
	}
}

const CONTEXT = {commandLine,stats: {},lib: {https,fs}};

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

function makeApp(args){
	let ctx = args.ctx;
	let commandLine = ctx.commandLine;
	let callback = args.callback;
	
	let appCheckCB = function(res){
		let ctx = this.ctx;
		let args = this.args;
		let callback = args.callback;
		
		//console.log(res);
		try {
			let data = JSON.parse(res);
			
			if( data.length > 0 ){
				args.ctx.lib.writeLog(2,"Has apps " + data.length);
				let idx = -1;
				for(let appIdx in data){
					if( data[appIdx].id == commandLine.appName ){
						idx = appIdx;
						args.ctx.lib.writeLog(2,"Has app " + commandLine.appName);
						break;
					}
				}
				
				if( idx > -1 ){
					ctx.stats.hasApp = true;
					if( callback ){
						callback(res);
					}
				}
				else {
					args.ctx.lib.writeLog(2,"Creating app " + commandLine.appName);
					//ctx.stats.hasApp = true;
					let createAppCB = function(res){
						let ctx = this.ctx;
						let args = this.args;
						let callback = args.callback;
						ctx.stats.hasApp = true;
						
						console.log("create app",res);
						if( callback ){
							callback(res);
						}
					}.bind({ctx,args});
					
					let payload = {"id": commandLine.appName, "name": commandLine.appName, "description":"a parker applications"};
					
			
					makeRESTCall({  
						ctx,
						host: ctx.commandLine.sourceHost,
						port: ctx.commandLine.sourcePort,
						path: "/api/apps",
						method: "POST",
						payload: JSON.stringify(payload),
						contentType: "application/json",
						authKey: ctx.commandLine.sourceKey,
						callback: createAppCB,
					});
				}
			}
			
		}
		catch(e){
			args.ctx.lib.writeLog(1,args + " " + e);
		}
	}.bind({ctx,args});
	
	makeRESTCall({  
					ctx,
					host: ctx.commandLine.sourceHost,
					port: ctx.commandLine.sourcePort,
					path: "/api/apps",
					method: "GET",
					contentType: "application/json",
					authKey: ctx.commandLine.sourceKey,
					callback: appCheckCB
				});
	
}

function schemaChangeCallback(res,statusCode){
	let ctx = this.ctx;
	let loopCtx = this.loopCtx;
	let callback = this.callback;
	let collection = this.collection;
	let contextPath = this.contextPath;
	let payload = this.payload;
	let file = this.file;
	let filePath = this.filePath;
	
	if( statusCode > 204 ){
		payload = payload.replaceAll("add-","replace-");
		makeRESTCall({  
					ctx,
					host: ctx.commandLine.sourceHost,
					port: ctx.commandLine.sourcePort,
					path: "/api/solr/" + collection + "/schema/",
					method: "POST",
					payload: payload,
					contentType: "application/json",
					authKey: ctx.commandLine.sourceKey,
					callback: schemaChangeCallback.bind({ctx,loopCtx,callback,collection,contextPath,payload,file,filePath}),
				});
	}
	else {
		ctx.lib.writeLog(1,"done with schema " + collection + " " + res);
		
		if( callback ){
			callback("done with schema " + collection + " " + res);
		}
	}
}

function configSetCallback(res,statusCode){
	let ctx = this.ctx;
	let loopCtx = this.loopCtx;
	let callback = this.callback;
	let collection = this.collection;
		
	if( statusCode > 204 ){
		let contextPath = this.contextPath;
		let payload = this.payload;
		let file = this.file;
		let filePath = this.filePath;
		
		ctx.lib.writeLog(2,file + " " + collection + " failed,  retrying");
		
		makeRESTCall({  
						ctx,
						host: ctx.commandLine.sourceHost,
						port: ctx.commandLine.sourcePort,
						path: "/api/collections/" + collection + "/solr-config/" + contextPath + "?reload=true",
						method: "PUT",
						payload: payload,
						contentType: "text/plain",
						authKey: ctx.commandLine.sourceKey,
						callback: configSetCallback.bind({ctx,callback,loopCtx,collection,file,filePath,payload,contextPath}),
					});
	}
	else {
		ctx.lib.writeLog(2,this.file + " " + collection + " success");
		loopCtx.offset++;
	}
	
	if( loopCtx.offset >= loopCtx.data.length ){
		ctx.lib.writeLog(2,"all text files loaded " + loopCtx.offset);
		for(let fileRec of loopCtx.schema){
			ctx.lib.writeLog(2,"loading schema changes " + fileRec.collection + " " + fileRec.file);
			fileRec.ctx = ctx;
			fileRec.loopCtx = loopCtx;
			fileRec.callback = callback;
			makeRESTCall({  
					ctx,
					host: ctx.commandLine.sourceHost,
					port: ctx.commandLine.sourcePort,
					path: "/api/solr/" + fileRec.collection + "/schema/",
					method: "POST",
					payload: fileRec.payload,
					contentType: "application/json",
					authKey: ctx.commandLine.sourceKey,
					callback: schemaChangeCallback.bind(fileRec),
				});
		}
	}
}

function addSchemaToCollection(args){
	let ctx = args.ctx;
	let callback = args.callback;
	let collection = args.collection;
	let configPath = ctx.commandLine.configDir + "/" + collection;
	
	if( ctx.lib.fs.existsSync(configPath) ){
		let files = ctx.lib.fs.readdirSync(configPath);
		
		if( files && files.length > 0 ){
			let filesToLoad = [];
			let schemaToLoad = [];
			for(let file of files){
				if( args.ctx.lib.fs.lstatSync(configPath + "/" + file).isDirectory() ){
					args.ctx.lib.writeLog(2,"is directory " + configPath + "/" + file);
					let subFiles = ctx.lib.fs.readdirSync(configPath + "/" + file);
					for(let subFile of subFiles){
						let filePath = configPath + "/" + file + "/" + subFile;
						let payload = ctx.lib.fs.readFileSync(filePath,'utf8');
						let contextPath = file + "/" + subFile;
						args.ctx.lib.writeLog(2,"loading file... " + collection + " " + filePath);
						filesToLoad.push({ctx,collection,file: subFile,filePath,payload,contextPath});
					}
				}
				else if( file.endsWith(".txt") ) {
					let filePath = configPath + "/" + file;
					let payload = ctx.lib.fs.readFileSync(filePath,'utf8');
					let contextPath = file;
					args.ctx.lib.writeLog(2,"is file " + collection + " " + filePath);
					filesToLoad.push({ctx,callback,collection,file,filePath,payload,contextPath});
				}
				else if( file == "schema.json" ) {
					let filePath = configPath + "/" + file;
					let payload = ctx.lib.fs.readFileSync(filePath,'utf8');
					let contextPath = file;
					args.ctx.lib.writeLog(2,"is schema file " + collection + " " + filePath);
					schemaToLoad.push({ctx,callback,collection,file,filePath,payload,contextPath});
				}
			}
			let loopCtx = {offset: 0,data: filesToLoad,schema: schemaToLoad}
			for(let fileRec of filesToLoad){
				fileRec.ctx = ctx;
				fileRec.loopCtx = loopCtx;
				makeRESTCall({  
						ctx,
						host: ctx.commandLine.sourceHost,
						port: ctx.commandLine.sourcePort,
						path: "/api/collections/" + fileRec.collection + "/solr-config/" + fileRec.contextPath + "?reload=true",
						method: "POST",
						payload: fileRec.payload,
						contentType: "text/plain",
						authKey: ctx.commandLine.sourceKey,
						callback: configSetCallback.bind(fileRec),
					});
			}
		}
		else{
			args.ctx.lib.writeLog(2,"no config files directory " + collection + " " + configPath);
		}
		
	}
	else {
		args.ctx.lib.writeLog(2,"no config files directory " + collection + " " + configPath);
	}
	
}

function makeCollections(args){
	let ctx = args.ctx;
	let commandLine = ctx.commandLine;
	let callback = args.callback;
	
	
	let createCollectionCB = function(res){
		let ctx = this.ctx;
		let callback = this.callback;
		let loopCtx = this.loopCtx;
		let collection = this.collection;
		
		loopCtx.offset++;
		//console.log(res);
		
		addSchemaToCollection({ctx,callback,collection});
		
		if( loopCtx.offset >= loopCtx.data.length ){
			callback(res);
		}
	}
	let loopCtx = {offset: 0,count: 0,data: ctx.commandLine.collections };
	
	for(let collection of ctx.commandLine.collections){
		
		if( collection != commandLine.appName ){
			let payload = {"id": collection,"name": collection,"solrParams":{"replicationFactor":commandLine.replicationFactor,"numShards":commandLine.numShards}};
						
				
			makeRESTCall({  
				ctx,
				host: ctx.commandLine.sourceHost,
				port: ctx.commandLine.sourcePort,
				path: "/api/apps/" + commandLine.appName + "/collections?relatedObjects=false&pipelines=false&defaultFeatures=false",
				method: "POST",
				payload: JSON.stringify(payload),
				contentType: "application/json",
				authKey: ctx.commandLine.sourceKey,
				callback: createCollectionCB.bind({ctx,collection,loopCtx,callback}),
			});
		}
		else {
			//collection alread there,  just change it
			createCollectionCB.bind({ctx,collection,loopCtx,callback})("already a collection");
			
		}
		
	}
	
	
	
}

function doWork(ctx){
	let commandLine = ctx.commandLine;
	//build app
	let callback = function(res){
		let ctx = this.ctx;
		
		if( ctx.stats.hasApp ){
			
			let callback = function(res){
					this.ctx.lib.writeLog(1,"done",ctx.stats);
			}.bind({ctx});
			
			makeCollections({ctx,callback});
			
		}
		else {
			console.log("failed","could not find or create app " + ctx.commandLine.appName);
			args.ctx.lib.writeLog(1,"done",ctx.stats);
		}
		
		
	}.bind({ctx});
	
	makeApp({ctx,callback});
	
}

doWork(CONTEXT);

