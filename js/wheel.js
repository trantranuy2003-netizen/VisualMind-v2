(() => {
    const KEY='visualmind-radar', C=window.ChecklistModel, {el,button,dialog,field,t}=window.DashboardUI;
    const defaults=['health','work','relationships','learning','finance','personal'];
    const read=()=>{try{return JSON.parse(localStorage.getItem(KEY))||{};}catch{return {};}};
    const load=()=>{
        const data=read(); if(data.wheel) return data.wheel;
        const latest=Object.keys(data.months||{}).sort().at(-1), old=data.months?.[latest];
        const names=data.categories?.length>=3?data.categories:null;
        const categories=names?names.map(name=>({id:crypto.randomUUID(),name})):defaults.map(key=>({id:key,key}));
        const goals=(old?.goals||[]).map(goal=>({id:goal.id,title:goal.title,categoryId:categories.find(c=>c.name===goal.category)?.id || categories[0].id,weight:0,smart:{},legacy:goal}));
        const state=C.load();
        const plannerGoals=state.items.filter(item=>item.kind==='goal');
        if(plannerGoals.length) data.legacyPlannerGoals=plannerGoals;
        for(const source of plannerGoals) {
            const category=categories.find(c=>c.name===source.category)||categories[0];
            const linked=C.all(state).filter(task=>task.parentId===source.id&&task.kind!=='goal');
            const goal={id:source.id,title:source.title,categoryId:category.id,weight:0,smart:{},legacy:source};goals.push(goal);
            linked.forEach(task=>{task.parentId=null;Object.assign(task,{wheelGoalId:goal.id,wheelWeight:100/Math.max(1,linked.length),wheelCap:1});});
        }
        state.items=state.items.filter(item=>item.kind!=='goal');
        for(const goal of goals) {
            const linked=C.all(state).filter(task=>goal.legacy.links?.some(ref=>ref.slice(ref.indexOf(':')+1)===task.id));
            linked.forEach(task=>{if(!task.wheelGoalId) Object.assign(task,{wheelGoalId:goal.id,wheelWeight:100/Math.max(1,linked.length),wheelCap:Math.max(1,Number(goal.legacy.target)||1)});});
        }
        localStorage.setItem('visualmind-weekly-planner',JSON.stringify(state));
        data.wheel={categories,goals}; localStorage.setItem(KEY,JSON.stringify(data)); return data.wheel;
    };
    const save=mutate=>{const data=read(),wheel=load();mutate(wheel);data.wheel=wheel;localStorage.setItem(KEY,JSON.stringify(data));document.dispatchEvent(new CustomEvent('visualmind-dashboard-change'));};
    const categoryName=c=>c.key?t(c.key):c.name;
    const completions=(task,tasks)=>{
        const records=[task,...tasks.filter(item=>item.seriesId===task.id&&!item.trashedAt)];
        return records.reduce((sum,item)=>sum+(item.completed?Math.max(1,(item.completedDates||[]).length):new Set((item.completedDates||[]).filter(date=>!item.excludedDates?.includes(date))).size),0);
    };
    const score=(wheel,categoryId,tasks=C.all())=>{
        const goals=wheel.goals.filter(goal=>goal.categoryId===categoryId);
        const total=goals.reduce((sum,goal)=>sum+Number(goal.weight||0),0);
        const actual=10*goals.reduce((sum,goal)=>sum+Number(goal.weight||0)/100*tasks.filter(task=>!task.trashedAt&&!task.seriesId&&task.wheelGoalId===goal.id).reduce((subtotal,task)=>subtotal+Number(task.wheelWeight||0)/100*Math.min(1,completions(task,tasks)/Math.max(1,Number(task.wheelCap)||1)),0),0);
        return {target:goals.length&&Math.abs(total-100)<1e-6?10:0,actual:Math.max(0,Math.min(10,actual)),total};
    };
    window.WheelModel={load,save,score,completions};
    window.setupWheel=dashboard=>{
        load();document.dispatchEvent(new CustomEvent('visualmind-dashboard-restored'));
        const card=el('section','todo-panel wheel-panel');card.dataset.wheel='';dashboard.append(card);
        const editGoal=(categoryId,existing,after)=>dialog('addGoal',(panel,close)=>{
            const form=el('form','wheel-form');panel.append(form);
            const title=field(form,'goalName','text',existing?.title||'');title.required=true;title.maxLength=160;
            const weight=field(form,'goalWeight','number',existing?.weight??'');weight.required=true;weight.min=0;weight.max=100;weight.step='any';
            const smart={};for(const key of ['S','M','A','R','T']) smart[key]=field(form,key,'textarea',existing?.smart?.[key]||'');
            const error=el('p','task-editor-error');error.setAttribute('role','alert');form.append(error);
            const submit=button('save',()=>{});submit.type='submit';form.append(submit);
            form.onsubmit=event=>{event.preventDefault();if(!title.value.trim())return;
                const total=load().goals.filter(goal=>goal.categoryId===categoryId&&goal.id!==existing?.id).reduce((sum,goal)=>sum+Number(goal.weight),0)+Number(weight.value);
                if(total>100+1e-8){error.textContent=t('invalidWeight');return;}
                save(wheel=>{const value={...existing,id:existing?.id||crypto.randomUUID(),categoryId,title:title.value.trim(),weight:Number(weight.value),smart:Object.fromEntries(Object.entries(smart).map(([key,input])=>[key,input.value.trim()]))};wheel.goals=wheel.goals.filter(goal=>goal.id!==value.id);wheel.goals.push(value);});close();after();
            };
        });
        const detail=category=>dialog(categoryName(category),(panel)=>{
            const body=el('div');panel.append(body);const opened=new Set();
            const draw=()=>{
                body.querySelectorAll('details[open]').forEach(node=>opened.add(node.dataset.goalId));
                body.replaceChildren();const wheel=load(),goals=wheel.goals.filter(goal=>goal.categoryId===category.id);
                body.append(el('p','radar-muted',t('weightNotice',{value:score(wheel,category.id).total})));
                if(!goals.length)body.append(el('p','',t('noGoals')));
                goals.forEach(goal=>{
                    const tree=el('details','wheel-goal');tree.dataset.goalId=goal.id;tree.open=opened.has(goal.id);tree.ontoggle=()=>{if(!tree.open)opened.delete(goal.id);};
                    const summary=el('summary','',goal.title+' · '+goal.weight+'%');summary.dataset.userContent='';tree.append(summary);
                    for(const key of ['S','M','A','R','T'])if(goal.smart?.[key]){const text=el('p','',key+': '+goal.smart[key]);text.dataset.userContent='';tree.append(text);}
                    tree.append(button('edit',()=>editGoal(category.id,goal,draw)),button('addTask',()=>window.editChecklistTask(null,{wheelGoalId:goal.id,category:categoryName(category)},draw),'+ '+t('addTask')));
                    const tasks=C.all();tasks.filter(task=>!task.trashedAt&&!task.seriesId&&task.wheelGoalId===goal.id).forEach(task=>{
                        const row=el('article','wheel-task'), title=el('span','',task.title);title.dataset.userContent='';row.append(title);
                        row.append(el('small','',`${C.all().length?completions(task,tasks):0} / ${task.wheelCap} · ${task.wheelWeight}%`));
                        row.append(el('small','',t('taskNotice',{value:(10*task.wheelWeight/100/task.wheelCap).toFixed(2),cap:task.wheelCap})));
                        row.append(button('edit',()=>window.editChecklistTask(task,{},draw)),button('remove',()=>{C.update(task.id,item=>{item.trashedAt=new Date().toISOString();});draw();},'×'));tree.append(row);
                    });body.append(tree);
                });
                body.append(button('addGoal',()=>editGoal(category.id,null,draw),'+ '+t('addGoal')));
            };
            draw();const refresh=()=>{if(panel.isConnected)draw();else document.removeEventListener('visualmind-dashboard-change',refresh);};document.addEventListener('visualmind-dashboard-change',refresh);
        },true);
        const settings=()=>dialog('categories',(panel,close)=>{
            const form=el('form','wheel-form');panel.append(form);const wheel=load();
            // Stable IDs keep goal links intact when an axis is renamed.
            const rows=wheel.categories.map(category=>({category,input:field(form,'categories','text',categoryName(category))}));
            const extra=field(form,'categoryNames','textarea');
            const error=el('p','task-editor-error');error.setAttribute('role','alert');form.append(error);
            const submit=button('save',()=>{});submit.type='submit';form.append(submit);
            form.onsubmit=event=>{event.preventDefault();const categories=rows.filter(({input})=>input.value.trim()).map(({category,input})=>({...category,key:input.value.trim()===categoryName(category)?category.key:undefined,name:input.value.trim()}));
                extra.value.split('\n').map(x=>x.trim()).filter(Boolean).forEach(name=>categories.push({id:crypto.randomUUID(),name}));
                if(categories.length<3||new Set(categories.map(categoryName)).size!==categories.length||load().goals.some(goal=>!categories.some(c=>c.id===goal.categoryId))){error.textContent=t('categoryError');return;}
                save(value=>{value.categories=categories;});close();
            };
        });
        const render=()=>{
            const wheel=load();card.replaceChildren();const header=el('div','dashboard-panel-heading');header.append(el('h2','',t('wheel')),button('categories',settings));card.append(header);
            const ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg');svg.setAttribute('viewBox','0 0 520 440');svg.setAttribute('role','group');svg.setAttribute('aria-label',t('wheel'));svg.classList.add('wheel-chart');
            const shape=(tag,attrs)=>{const node=document.createElementNS(ns,tag);for(const [key,value]of Object.entries(attrs))node.setAttribute(key,value);svg.append(node);return node;};
            const point=(index,value,radius=155)=>{const a=-Math.PI/2+index*2*Math.PI/wheel.categories.length;return [260+Math.cos(a)*radius*value/10,220+Math.sin(a)*radius*value/10];};
            for(let value=2;value<=10;value+=2){shape('polygon',{points:wheel.categories.map((_,i)=>point(i,value).join(',')).join(' '),class:'wheel-grid'});const label=shape('text',{x:265,y:220-value/10*155,class:'wheel-tick'});label.textContent=value;}
            wheel.categories.forEach((category,index)=>{const p=point(index,10);shape('line',{x1:260,y1:220,x2:p[0],y2:p[1],class:'wheel-grid'});});
            for(const mode of ['target','actual'])shape('polygon',{points:wheel.categories.map((category,i)=>point(i,score(wheel,category.id)[mode]).join(',')).join(' '),class:'wheel-'+mode});
            wheel.categories.forEach((category,index)=>{
                const p=point(index,10),labelPoint=point(index,10,185),value=score(wheel,category.id);
                const hit=shape('circle',{cx:p[0],cy:p[1],r:9,class:'wheel-hit',role:'button',tabindex:0,'aria-label':categoryName(category)+` ${value.actual.toFixed(1)} / 10`});hit.onclick=()=>detail(category);hit.onkeydown=event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();detail(category);}};
                const label=shape('text',{x:labelPoint[0],y:labelPoint[1],'text-anchor':'middle',class:'wheel-label'});label.textContent=categoryName(category);label.onclick=()=>detail(category);
            });
            card.append(svg);const legend=el('div','wheel-legend');legend.append(el('span','wheel-target-key',t('target')),el('span','wheel-actual-key',t('actual')));card.append(legend);
        };
        document.addEventListener('visualmind-dashboard-change',render);
        document.addEventListener('visualmind-dashboard-restored',()=>{const migrated=!read().wheel;render();if(migrated)document.dispatchEvent(new CustomEvent('visualmind-dashboard-restored'));});
        document.addEventListener('visualmind-preferences',render);render();
    };
})();
