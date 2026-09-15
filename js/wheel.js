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
        const records=[task,...tasks.filter(item=>item.seriesId===task.id&&!item.trashedAt&&item.wheelGoalId===task.wheelGoalId&&(!Object.hasOwn(item,'wheelCategoryId')||!Object.hasOwn(task,'wheelCategoryId')||item.wheelCategoryId===task.wheelCategoryId))];
        return records.reduce((sum,item)=>sum+(item.completed?Math.max(1,(item.completedDates||[]).length):new Set((item.completedDates||[]).filter(date=>!item.excludedDates?.includes(date))).size),0);
    };
    const palette=['#f6d5df','#d4e6fa','#d6eddd','#e5dafa','#f9e5c7','#d1eceb'];
    const categoryColor=category=>category.color || palette[Math.max(0,load().categories.findIndex(item=>item.id===category.id))%palette.length];
    const textColor=color=>{
        const hex=/^#[0-9a-f]{6}$/i.test(color||'')?color:'#ffffff';
        const channels=[1,3,5].map(index=>parseInt(hex.slice(index,index+2),16)/255).map(value=>value<=0.04045?value/12.92:((value+0.055)/1.055)**2.4);
        const luminance=channels[0]*0.2126+channels[1]*0.7152+channels[2]*0.0722;
        return (luminance+0.05)/0.05>=1.05/(luminance+0.05)?'#000000':'#ffffff';
    };
    const pointsPerDone=task=>Number(task.wheelPoints ?? (10/Math.max(1,Number(task.wheelCap)||1)));
    const goalScore=(goal,tasks=C.all())=>Math.min(10,tasks.filter(task=>!task.trashedAt&&!task.seriesId&&task.wheelGoalId===goal.id&&(!Object.hasOwn(task,'wheelCategoryId')||task.wheelCategoryId===goal.categoryId)).reduce((sum,task)=>sum+Number(task.wheelWeight||0)/100*pointsPerDone(task)*completions(task,tasks),0));
    const score=(wheel,categoryId,tasks=C.all())=>{
        if(wheel.categories&&!wheel.categories.some(category=>category.id===categoryId))return {target:0,actual:0,total:0};
        const goals=wheel.goals.filter(goal=>goal.categoryId===categoryId);
        const total=goals.reduce((sum,goal)=>sum+Number(goal.weight||0),0);
        const actual=goals.reduce((sum,goal)=>sum+Number(goal.weight||0)/100*goalScore(goal,tasks),0);
        return {target:goals.length&&Math.abs(total-100)<1e-6?10:0,actual:Math.max(0,Math.min(10,actual)),total};
    };
    const archiveGoal=id=>save(wheel=>{const goal=wheel.goals.find(item=>item.id===id);if(!goal)return;wheel.archivedGoals=[...(wheel.archivedGoals||[]).filter(item=>item.id!==id),goal];wheel.goals=wheel.goals.filter(item=>item.id!==id);});
    const restoreGoal=id=>{
        const wheel=load(),goal=wheel.archivedGoals?.find(item=>item.id===id);if(!goal)return '';
        if(wheel.goals.filter(item=>item.categoryId===goal.categoryId).reduce((sum,item)=>sum+Number(item.weight||0),0)+Number(goal.weight)>100+1e-8)return t('invalidWeight');
        save(value=>{value.goals.push(goal);value.archivedGoals=value.archivedGoals.filter(item=>item.id!==id);});return '';
    };
    window.WheelModel={load,save,score,goalScore,pointsPerDone,categoryColor,textColor,completions,categoryName,archiveGoal,restoreGoal};
    window.setupWheel=dashboard=>{
        load();document.dispatchEvent(new CustomEvent('visualmind-dashboard-restored'));
        const card=el('section','todo-panel wheel-panel');card.dataset.wheel='';dashboard.append(card);
        const editGoal=(categoryId,existing,after)=>dialog('addGoal',(panel,close)=>{
            const form=el('form','wheel-form');panel.append(form);
            const title=field(form,'goalName','text',existing?.title||'');title.required=true;title.maxLength=160;
            const weight=field(form,'goalWeight','number',existing?.weight??'');weight.required=true;weight.min=0;weight.max=100;weight.step='any';
            const error=el('p','task-editor-error');error.setAttribute('role','alert');form.append(error);
            const submit=button('save',()=>{});submit.type='submit';form.append(submit);
            form.onsubmit=event=>{event.preventDefault();if(!title.value.trim())return;
                const total=load().goals.filter(goal=>goal.categoryId===categoryId&&goal.id!==existing?.id).reduce((sum,goal)=>sum+Number(goal.weight),0)+Number(weight.value);
                if(total>100+1e-8){error.textContent=t('invalidWeight');return;}
                save(wheel=>{const value={...existing,id:existing?.id||crypto.randomUUID(),categoryId,title:title.value.trim(),weight:Number(weight.value)};wheel.goals=wheel.goals.filter(goal=>goal.id!==value.id);wheel.goals.push(value);});close();after();
            };
        });
        const detail=category=>dialog(categoryName(category),(panel)=>{
            panel.classList.add('wheel-tree-dialog');panel.style.setProperty('--category-pastel',categoryColor(category));
            const body=el('div','wheel-tree');panel.append(body);const collapsed=new Set();
            const draw=()=>{
                body.replaceChildren();const wheel=load(),goals=wheel.goals.filter(goal=>goal.categoryId===category.id);
                const background=categoryColor(wheel.categories.find(item=>item.id===category.id)||category);
                panel.style.setProperty('--category-pastel',background);panel.style.setProperty('--category-text',textColor(background));
                body.append(el('p','radar-muted',t('weightNotice',{value:score(wheel,category.id).total})));
                const columns=el('div','wheel-tree-row wheel-tree-columns');
                for(const key of ['goalTask','weight','pointsPerDone','score','actions'])columns.append(el('span','',t(key)));
                body.append(columns);
                if(!goals.length)body.append(el('p','',t('noGoals')));
                goals.forEach(goal=>{
                    const tasks=C.all(), children=tasks.filter(task=>!task.trashedAt&&!task.seriesId&&task.wheelGoalId===goal.id);
                    const tree=el('section','wheel-tree-goal');tree.dataset.goalId=goal.id;
                    const row=el('div','wheel-tree-row'), name=el('div','wheel-tree-name');
                    const branch=el('div','wheel-tree-children');branch.id='wheel-children-'+goal.id;branch.hidden=collapsed.has(goal.id);
                    const toggle=button('toggleChildren',()=>{branch.hidden=!branch.hidden;branch.hidden?collapsed.add(goal.id):collapsed.delete(goal.id);toggle.textContent=branch.hidden?'›':'⌄';toggle.dataset.uiTemplate=toggle.textContent;toggle.setAttribute('aria-expanded',String(!branch.hidden));},branch.hidden?'›':'⌄');
                    toggle.setAttribute('aria-expanded',String(!branch.hidden));toggle.setAttribute('aria-controls',branch.id);
                    const icon=el('span','wheel-goal-icon');icon.innerHTML=window.goalIcon;icon.setAttribute('role','img');icon.setAttribute('aria-label',t('goal'));
                    const title=el('span','',goal.title);title.dataset.userContent='';name.append(toggle,icon,title);
                    const actions=el('div','wheel-tree-actions');actions.append(button('edit',()=>editGoal(category.id,goal,draw),'✎'),button('addTask',()=>window.editChecklistTask(null,{wheelGoalId:goal.id,category:categoryName(category)},draw),'+'),button('archiveGoal',()=>archiveGoal(goal.id),'×'));
                    row.append(name,el('span','',goal.weight+'%'),el('span','','—'),el('span','',goalScore(goal,tasks).toFixed(2)+' / 10'),actions);tree.append(row,branch);
                    children.forEach(task=>{
                        const taskRow=el('div','wheel-tree-row wheel-tree-task');taskRow.dataset.wheelTask=task.id;
                        const taskName=el('div','wheel-tree-name');
                        const date=task.repeat?C.today():(task.fromDate||task.dates?.[0]||C.today());
                        const check=el('input');check.type='checkbox';check.checked=C.done(task,date);check.setAttribute('aria-label',t('completeTask',{title:task.title}));check.title=t('completion')+' · '+date;
                        check.disabled=Boolean(task.repeat&&!window.CalendarModel.occurs(task,date));check.onchange=()=>C.toggle(task.id,date,check.checked);
                        const taskIcon=el('span','wheel-task-icon','▤');taskIcon.setAttribute('role','img');taskIcon.setAttribute('aria-label',t('task'));
                        const text=el('span','',task.title);text.dataset.userContent='';taskName.append(check,taskIcon,text);
                        const taskActions=el('div','wheel-tree-actions');taskActions.append(button('edit',()=>window.editChecklistTask(task,{},draw),'✎'),button('remove',()=>C.update(task.id,item=>{item.trashedAt=new Date().toISOString();}),'×'));
                        const count=el('span','wheel-done-count',completions(task,tasks));count.title=t('taskNotice',{value:(task.wheelWeight/100*pointsPerDone(task)).toFixed(2)});
                        taskRow.append(taskName,el('span','',task.wheelWeight+'%'),el('span','',pointsPerDone(task).toFixed(2)),count,taskActions);branch.append(taskRow);
                    });body.append(tree);
                });
                body.append(button('addGoal',()=>editGoal(category.id,null,draw),'+ '+t('addGoal')));
                const archiveError=el('p','task-editor-error');archiveError.setAttribute('role','alert');body.append(archiveError);
                for(const goal of wheel.archivedGoals||[])if(goal.categoryId===category.id)body.append(button('restoreGoal',()=>{archiveError.textContent=restoreGoal(goal.id);},t('restoreGoal')+': '+goal.title));
            };
            draw();const events=['visualmind-dashboard-change','visualmind-dashboard-restored','visualmind-preferences'];const refresh=()=>{if(panel.isConnected)draw();else events.forEach(event=>document.removeEventListener(event,refresh));};events.forEach(event=>document.addEventListener(event,refresh));
        },true);
        const settings=(after=()=>{})=>dialog('categories',(panel,close)=>{
            const form=el('form','wheel-form');panel.append(form);const wheel=load();
            const rows=[];const list=el('div','wheel-axis-list');form.append(list);
            const addRow=category=>{
                const row=el('div','wheel-axis-row'),input=el('input');input.type='text';input.value=categoryName(category)||'';input.required=true;input.maxLength=80;input.setAttribute('aria-label',t('axisName'));
                const color=el('input');color.type='color';color.value=categoryColor(category);color.setAttribute('aria-label',t('Màu danh mục'));
                const preview=()=>{input.style.backgroundColor=color.value;input.style.color=textColor(color.value);};color.oninput=preview;preview();
                const entry={category,input,color,row};rows.push(entry);row.append(input,color,button('removeAxis',()=>{rows.splice(rows.indexOf(entry),1);row.remove();},'×'));list.append(row);return input;
            };
            wheel.categories.forEach(addRow);
            form.append(button('addAxis',()=>addRow({id:crypto.randomUUID(),name:''}).focus(),'+ '+t('addAxis')));
            for(const category of wheel.archivedCategories||[])form.append(button('restoreAxis',()=>{if(!rows.some(entry=>entry.category.id===category.id))addRow(category);},t('restoreAxis')+': '+categoryName(category)));
            form.append(el('p','radar-muted',t('axisRemovalNote')));
            const error=el('p','task-editor-error');error.setAttribute('role','alert');form.append(error);
            const submit=button('save',()=>{});submit.type='submit';form.append(submit);
            form.onsubmit=event=>{event.preventDefault();const categories=rows.map(({category,input,color})=>({...category,color:color.value,key:input.value.trim()===categoryName(category)?category.key:undefined,name:input.value.trim()}));
                if(categories.length<3||categories.some(c=>!c.name)||new Set(categories.map(c=>categoryName(c).toLocaleLowerCase())).size!==categories.length){error.textContent=t('axisValidation');return;}
                save(value=>{value.archivedCategories=[...(value.archivedCategories||[]),...value.categories].filter((c,i,all)=>!categories.some(active=>active.id===c.id)&&all.findIndex(other=>other.id===c.id)===i);value.categories=categories;});close();if(typeof after==='function')after();
            };
        });
        window.WheelUI={editGoal,settings};
        const render=()=>{
            const wheel=load();card.replaceChildren();const header=el('div','dashboard-panel-heading');const gear=button('categories',settings,'⚙');gear.classList.add('wheel-settings');header.append(el('h2','',t('wheel')),gear);card.append(header);
            const ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg');svg.setAttribute('viewBox','0 0 520 440');svg.setAttribute('role','group');svg.setAttribute('aria-label',t('wheel'));svg.classList.add('wheel-chart');
            const shape=(tag,attrs)=>{const node=document.createElementNS(ns,tag);for(const [key,value]of Object.entries(attrs))node.setAttribute(key,value);svg.append(node);return node;};
            const point=(index,value,radius=155)=>{const a=-Math.PI/2+index*2*Math.PI/wheel.categories.length;return [260+Math.cos(a)*radius*value/10,220+Math.sin(a)*radius*value/10];};
            for(let value=2;value<=10;value+=2){shape('polygon',{points:wheel.categories.map((_,i)=>point(i,value).join(',')).join(' '),class:'wheel-grid'});const label=shape('text',{x:265,y:220-value/10*155,class:'wheel-tick'});label.textContent=value;}
            wheel.categories.forEach((category,index)=>{const p=point(index,10);shape('line',{x1:260,y1:220,x2:p[0],y2:p[1],class:'wheel-grid'});});
            for(const mode of ['target','actual'])shape('polygon',{points:wheel.categories.map((category,i)=>point(i,score(wheel,category.id)[mode]).join(',')).join(' '),class:'wheel-'+mode});
            wheel.categories.forEach((category,index)=>{
                const p=point(index,10),labelPoint=point(index,10,185),value=score(wheel,category.id);
                const hit=shape('circle',{cx:p[0],cy:p[1],r:9,class:'wheel-hit',role:'button',tabindex:0,'aria-label':categoryName(category)+` ${value.actual.toFixed(1)} / 10`});hit.style.fill=categoryColor(category);hit.onclick=()=>detail(category);hit.onkeydown=event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();detail(category);}};
                const label=shape('text',{x:labelPoint[0],y:labelPoint[1],'text-anchor':'middle',class:'wheel-label'});label.textContent=categoryName(category);label.onclick=()=>detail(category);
            });
            card.append(svg);const legend=el('div','wheel-legend');legend.append(el('span','wheel-target-key',t('target')),el('span','wheel-actual-key',t('actual')));card.append(legend);
        };
        document.addEventListener('visualmind-dashboard-change',render);
        document.addEventListener('visualmind-dashboard-restored',()=>{const migrated=!read().wheel;render();if(migrated)document.dispatchEvent(new CustomEvent('visualmind-dashboard-restored'));});
        document.addEventListener('visualmind-preferences',render);render();
    };
})();
