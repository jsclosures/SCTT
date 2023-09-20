function(commandLine){
    const batchSize = commandLine.hasOwnProperty('batchSize') ? commandLine['batchSize'] : 10;
    const testName = commandLine.hasOwnProperty('testName') ? commandLine['testName'] : 'default';
    
    const validateSolrHost = commandLine.hasOwnProperty('validateSolrHost') ? commandLine['validateSolrHost'] : CONTEXT.SOLRHOST;
    const validateSolrPort = commandLine.hasOwnProperty('validateSolrPort') ? commandLine['validateSolrPort'] : CONTEXT.SOLRPORT;
    const validateSolrCollection = commandLine.hasOwnProperty('validateSolrCollection') ? commandLine['validateSolrCollection'] : CONTEXT.SOLRCOLLECTION;
    const validateSolrPath = commandLine.hasOwnProperty('validateSolrPath') ? commandLine['validateSolrPath'] : "/api/solr/" + validateSolrCollection + "/select?q=(contenttype:SUMMARY+AND+testname:" + testName + ")&wt=json&sort=id+desc&rows=" + batchSize;
    const validateSolrTypeField = commandLine.hasOwnProperty('validateSolrTypeField') ? commandLine['validateSolrTypeField'] : "contenttype";
    const validateSolrType = commandLine.hasOwnProperty('validateSolrType') ? commandLine['validateSolrType'] : "SUMMARY";
    
    var cursorMark = "*";
    var queryCount = 0;
    const LOOPCTX = {offset: 0,docs: [],size: 0,buffer: "query,environment,delta,rowcount,doc\n"}; 
    
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
                doComplete(ctx);
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
    
                loopResults.bind({ctx,hasMore})();
            }
    
      });
    }
    
    function rowCallback(res) {
        let queryDoc = this.queryDoc;
        let hasMore = this.hasMore;
        let ctx = this.ctx;
    
        console.wslog(queryDoc.id,"CB");
        console.wslog("checking query count",queryCount);
        if( queryCount <= 0 ) {
            console.wslog("call load sybc",hasMore);
        }
        loopResults.bind({ctx,hasMore})();
    }
    
    function validateQuery(doc,hasMore,ctx){
        let tCallback = rowCallback.bind({queryDoc: doc,hasMore: hasMore,ctx});
        //console.log(doc);
                
        let rowcountbefore = doc["rowcountbefore"];
        let rowcountafter = doc["rowcountafter"];
        let qtimeb = doc["qtimeb"];
        let qtimea = doc["qtimea"];
        let qtime = doc["qtime"];
        let rowcountb = doc["rowcountb"];
        let rowcounta = doc["rowcounta"];
        let rowcount = doc["rowcount"];
        let matchscore = doc["matchscore"];
        let matchscorelist = doc["matchscorelist"];
        let differencescore = doc["differencescore"];
        let countscore = doc["countscore"];

        if( ctx.offset > 1 )
            ctx.buffer += "\n";

        let topdocbefore = doc["topdocbefore"];
        if( topdocbefore && topdocbefore.indexOf("~") ){
            let docs = topdocbefore.split("~");
            let buffer = "";
            for(let recStr of docs){
                if( buffer.length > 0 ){
                    buffer += "\n";
                }
                buffer += doc.query_txt  + "," + "PREPROD" + "," + rowcount + "," + rowcountb  + "," + recStr.replaceAll("::",",");
            }
            ctx.buffer += buffer + "\n";
        }
        else {
            buffer += doc.query_txt  + "," + "PREPROD" + "," + rowcount + "," + rowcountb  + "," + topdocbefore;
            ctx.buffer += buffer + "\n";
        }

        let topdocafter = doc["topdocafter"];
        if( topdocafter && topdocafter.indexOf("~") ){
            let docs = topdocafter.split("~");
            let buffer = "";
            for(let recStr of docs){
                if( buffer.length > 0 ){
                    buffer += "\n";
                }
                buffer += doc.query_txt  + "," + "PROD" + "," + rowcount + "," + rowcounta  + "," + recStr.replaceAll("::",",");
            }
            ctx.buffer += buffer;
        }
        else {
            buffer += doc.query_txt  + "," + "PROD" + "," + rowcount + "," + rowcounta  + "," + topdocafter;
        }
        
        tCallback();
    }
    
    function loadValidationData(cursorMark,ctx){
        let tCallback = validateCallback.bind({ctx});
        
        let tValidateSolrPath = validateSolrPath + "&cursorMark=" + cursorMark;
        console.log(tValidateSolrPath);
        let conf = {hostname: validateSolrHost,port: validateSolrPort,path: tValidateSolrPath,method: 'GET',headers: {'Content-Type': 'application/json'}};
    
        if( CONTEXT.AUTHKEY )
            conf.headers['Authorization'] = 'Basic ' + CONTEXT.AUTHKEY;
        let t = CONTEXT.lib.https.request(conf, tCallback);
        t.on('error', function(e) {console.log("Got error: " + e.message);});
        t.end();
    }
    
    function doComplete(ctx){
        if( commandLine.callback ){
            console.log("do complete callback");
            commandLine.callback({payload: ctx.buffer,headers: [{name: "Content-Type",value: "application/csv"}]});
        }
    }
    
    loadValidationData(cursorMark,LOOPCTX);
    
    }