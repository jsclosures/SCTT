function(commandLine){
    var solrHost = commandLine.hasOwnProperty('solrHost') ? commandLine['solrHost'] : CONTEXT.SOLRHOST;
    var solrPort = commandLine.hasOwnProperty('solrPort') ? commandLine['solrPort'] : CONTEXT.SOLRPORT;
    var solrCollection = commandLine.hasOwnProperty('solrCollection') ? commandLine['solrCollection'] : CONTEXT.SOLRCOLLECTION;
    var solrPath = commandLine.hasOwnProperty('solrPath') ? commandLine['solrPath'] : "/api/solr/" + solrCollection + "/update";
    var batchSize = commandLine.hasOwnProperty('batchSize') ? commandLine['batchSize'] : 10;
    var inFileName = commandLine.hasOwnProperty('inFileName') ? commandLine['inFileName'] : '/tmp/out_solr.log';
    var testName = commandLine.hasOwnProperty('testName') ? commandLine['testName'] : 'coveobase';
    var startTag = commandLine.hasOwnProperty('startTag') ? commandLine['startTag'] : 'params={';
    var endTag = commandLine.hasOwnProperty('endTag') ? commandLine['endTag'] : '} hits=';
    var keyTag = commandLine.hasOwnProperty('keyTag') ? commandLine['keyTag'] : '';
    var requiredTag = commandLine.hasOwnProperty('requiredTag') ? commandLine['requiredTag'] : "c:" + testName;
    var idSeed = commandLine.hasOwnProperty('idSeed') ? commandLine['idSeed'] : 'SEARCH';
    var ignorePattern = commandLine.hasOwnProperty('ignorePattern') ? commandLine['ignorePattern'].split(",") : ['q=*:*&rows=0&wt=json','numTerms=0&show=index&wt=json'];
    var doWork = commandLine.hasOwnProperty('doWork') ? commandLine['doWork'] === 'true' : true;
    let passThroughParams = commandLine.hasOwnProperty('passThroughParams') ? commandLine['passThroughParams'].split(",") : ["*"];
    var useAsSeed  = commandLine.hasOwnProperty('useAsSeed') ? commandLine['useAsSeed'] === 'true' : true;
    var seedTemplate = commandLine.hasOwnProperty('seedTemplate') ? commandLine['seedTemplate'] : '';
    var csvData  = commandLine.hasOwnProperty('csvData') ? commandLine['csvData'].replace(/\+/g,' ') : false;
    
    function callback(res) {
    
        var str = "";
    
        res.on('data', function (chunk) {
                str += chunk;
                
            });
    
        res.on('end', function () {
            //console.log(res.field);
            console.log(str);
        });
    }
    
    
    function extractParams(str){
       let result = [];
    
       if( str ){
          try {
              var uParams = new URLSearchParams(str);
              uParams.forEach(function(value,key){ result.push({name: key,value: value});});
    
          }
          catch(e){
            console.log("failed parsing: " + e);
          }
    
       }
    
       return( result );
    }
    
    function checkParam(p){
        let result = false;
            let tp = p + "";
    
            for(let i in passThroughParams){
            if( passThroughParams[i] == "*" || (passThroughParams[i].endsWith("*") && tp.startsWith(passThroughParams[i].substring(0,passThroughParams[i].length-1)) ) || tp.indexOf(passThroughParams[i]) > -1 ){
                result = true;
                break;
            }
        } 
        return( result );
    }
    
    function checkIgnorePattern(p){
        let result = false;
    
            for(let i in ignorePattern){
            if( p.indexOf(ignorePattern[i]) > -1 ){
                result = true;
                break;
            }
        } 
        return( result );
    }
    
    function getRequiredParams(line){
       let result = '';
       let params = extractParams(line);
    
       for(let i in params){
         let p = params[i].name;
    
         if(  checkParam([p]) ){
    
            if( result.length > 0 ) result += "&";
            result += p + "=" + params[i].value;
         }
       }
       console.log("params",result);
    
       return( result );
    }
    
    function flattenFrame(rec){
        let result = '';
    
        if( rec ) {
            for(let p in rec){
                 if( result.length > 0 ) result += "&";
                 result += p + '=' + rec[p];
            }
        }
    console.log("flatten",result);
        return( result );
    }
    
    var rl = false;
    
    if( csvData ){
        var instream = new CONTEXT.lib.stream.PassThrough()
        instream.write(csvData);
        instream.end();
        rl = CONTEXT.lib.readline.createInterface({
            input: instream,
            terminal: false
            });
    }
    else {
        var instream = CONTEXT.lib.fs.createReadStream(inFileName);
        instream.readable = true;
    
        rl = CONTEXT.lib.readline.createInterface({
        input: instream,
        terminal: false
        });
    }
    
    var rowCounter = 0;
    var rowList = [];
    
    function readFunc(line) {
        //onsole.log(line);
        if( useAsSeed ){
            let tRec = {id: idSeed + testName + rowCounter,"contenttype": 'SEARCH',"testname": testName};
            tRec["query_txt"] = seedTemplate + line;
            //console.log("data",tRec);
            rowList.push(tRec);
            
            if( rowList.length > batchSize ){
                sendToSolr(callback);
            }
            rowCounter++;
        }
        else {
          let idx = -1;
          if( line.indexOf("http:") < 0 && ( !requiredTag || line.indexOf(requiredTag) > -1 ) && (idx = line.indexOf(startTag)) > -1 ){
              line = line.substring(idx+startTag.length);
              if(  keyTag && (idx = line.indexOf(keyTag)) > -1 ){
                  line = line.substring(idx+keyTag.length).trim();
              }
              
              if( (idx = line.indexOf(endTag)) > -1 ){
                  line = line.substring(0,idx).trim();
                  if( !checkIgnorePattern(line) ){
                  //if( line.indexOf("wt=javabin") > -1 )  line = line.replace("wt=javabin","wt=json");
                  //if( line.indexOf("shard.url=") > -1 )  line = line.replace("shard.url=","tshard.url=");
                  //if( line.indexOf("distrib=false") > -1 )  line = line.replace("distrib=false","distrib=true");
                  console.log(line);
              
                  let tRec = {id: idSeed + testName + rowCounter,"contenttype": 'SEARCH',"testname": testName};
                  //tRec["query_txt"] = line;
              tRec["query_txt"] = getRequiredParams(line);
                  //console.log("data",tRec);
                  rowList.push(tRec);
                  
                  if( rowList.length > batchSize ){
                      sendToSolr(callback);
                  }
                  rowCounter++;
                  }
              }
    
              
          }
          else {
            console.log("invalid line", ( !requiredTag || line.indexOf(requiredTag) > -1 ) && line.indexOf(startTag) > -1? line : "IV",startTag );
          }
        }
    }
    
    function sendToSolr(callback){
        console.wslog(rowList);
        if( doWork ){
        let tCallback = callback.bind({});
        let conf = {hostname: solrHost,port: solrPort,path: solrPath,method: 'POST',headers: {'Content-Type': 'application/json'}};
        if( CONTEXT.AUTHKEY ){
             conf.headers['Authorization'] = 'Basic ' + CONTEXT.AUTHKEY;
        }
        let t = CONTEXT.lib.https.request(conf, tCallback);
        t.on('error', function(e) {console.log("Got error: " + e.message);});
        t.write(JSON.stringify(rowList));
        t.end();
        }
        rowList = [];
    }
    
    function doCommit(){
        if( doWork ){
            let doFinally = function(){
                var tCallback = callback.bind({});
                let conf = {hostname: solrHost,port: solrPort,path: solrPath,method: 'POST',headers: {'Content-Type': 'application/json'}};
                if( CONTEXT.AUTHKEY ){
                    conf.headers['Authorization'] = 'Basic ' + CONTEXT.AUTHKEY;
                 }
                conf.path = solrPath + "?commit=true";
                var t = CONTEXT.lib.https.get(conf, tCallback);
    
                if( commandLine.callback ) commandLine.callback(commandLine.resultContext);
            }
    
            if( rowList && rowList.length > 0 )
                sendToSolr(doFinally);
            else    
                doFinally();
        }
    }
    if( rl ) rl.on('line', readFunc);
    if( rl ) rl.on('close', doCommit);
    }