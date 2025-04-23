function(commandLine,callback){

	const solrHost = CONTEXT.SOLRHOST;
	const solrPort = CONTEXT.SOLRPORT;
	let solrPath = CONTEXT.SOLRPREFIX + "validate/select?q=*:*";
			
			let testName = "default"; 
	
			if( commandLine.testname )
				testName = args.queryObj.testname;
			
			if( testName ){
				solrPath += "&fq=testname:" + testName;
			}

			if( commandLine.username ){
				solrPath += "&fq=username_s:" + commandLine.username;
			}

			let finalResult = {items: []};
	
			const collectorCB = function(data){
				if( data.items ){
					this.result.items = this.result.items.concat(data.items);
					this.result.numFound = this.result._totalItems;
					console.log("concat items",this.result,this);
				}
	
				if( this.nextEntry )
					CONTEXT.lib.getRESTData({host: solrHost,port: solrPort,path: this.nextEntry.path,type: this.nextEntry.type,callback: this.nextEntry.callback,entry: this.nextEntry});
				else
					this.callback(this.result);
			}
			const pathList = [
							{type: "query",label: "SummaryMaxQTimes",field: "qtime",path: solrPath + "&fq=contenttype:SUMMARY&rows=1&sort=qtime+desc"},
							{type: "query",label: "SummaryMaxRowCount",field: "rowcount",path: solrPath + "&fq=contenttype:SUMMARY&rows=1&sort=rowcount+desc"},
							{type: "query",label: "SummaryMinQTime",field: "qtime",path: solrPath + "&fq=contenttype:SUMMARY&rows=1&sort=qtime+asc"},
							{type: "query",label: "SummaryMinRowCount",field: "rowcount",path: solrPath + "&fq=contenttype:SUMMARY&rows=1&sort=rowcount+asc"},
							
							{type: "query",label: "BeforeMaxQTime",field: "qtime",path: solrPath + "&fq=contenttype:BEFORE&rows=1&sort=qtime+desc"},
							{type: "query",label: "BeforeMaxRowCount",field: "rowcount",path: solrPath + "&fq=contenttype:BEFORE&rows=1&sort=rowcount+desc"},
							{type: "query",label: "AfterMaxQTime",field: "qtime",path: solrPath + "&fq=contenttype:AFTER&rows=1&sort=qtime+desc"},
							{type: "query",label: "AfterMaxRowCount",field: "rowcount",path: solrPath + "&fq=contenttype:AFTER&rows=1&sort=rowcount+desc"},
							
	
							{type: "query",label: "BeforeMinQTime",field: "qtime",path: solrPath + "&fq=contenttype:BEFORE&rows=1&sort=qtime+asc"},
							{type: "query",label: "BeforeMinRowCount",field: "rowcount",path: solrPath + "&fq=contenttype:BEFORE&rows=1&sort=rowcount+asc"},
							{type: "query",label: "AfterMinQTime",field: "qtime",path: solrPath + "&fq=contenttype:AFTER&rows=1&sort=qtime+asc"},
							{type: "query",label: "AfterMinRowCount",field: "rowcount",path: solrPath + "&fq=contenttype:AFTER&rows=1&sort=rowcount+asc"},
	
							/*{type: "query",label: "ZeroRowCountA",field: "rowcounta",path: solrPath + "&fq=contenttype:AFTER&fq=rowcounta:0&rows=1&sort=rowcounta+asc"},
							{type: "query",label: "ZeroRowCountB",field: "rowcountb",path: solrPath + "&fq=contenttype:BEFORE&fq=rowcountb:0&rows=1&sort=rowcountb+asc"},
							{type: "query",label: "ZeroRowCount",field: "rowcount",path: solrPath + "&fq=contenttype:BEFORE&fq=rowcount:0&rows=1&sort=rowcount+asc"},*/
							
							{type: "facet",path: solrPath + "&facet.field=contenttype&facet=on&facet.mincount=1&rows=0"}
							];
			for(let i = 0;i < pathList.length;i++){
				if( i+1 < pathList.length )
					pathList[i].callback = collectorCB.bind({args: commandLine,result: finalResult,nextEntry: pathList[i+1],callback: callback });
				else    
					pathList[i].callback = collectorCB.bind({args: commandLine,result: finalResult,callback: callback });
			}
	
			console.log("solrpath",pathList[0].path);
			CONTEXT.lib.getRESTData({host: solrHost,port: solrPort,path: pathList[0].path,type: pathList[0].type,callback: pathList[0].callback,entry: pathList[0]});
	
	
	}