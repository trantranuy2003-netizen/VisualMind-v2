(() => {
    const C = window.ChecklistModel, U = window.DashboardUI;
    const { el, button, dialog, field, select, t } = U;
    const formatDate = value => value ? value.split('-').reverse().join('/') : '';
    const parseDate = value => {
        if (!value.trim()) return '';
        if (!/^\d{2}\/\d{2}\/\d{4}$/.test(value)) return null;
        const iso=value.split('/').reverse().join('-');
        return window.CalendarModel.key(window.CalendarModel.day(iso))===iso ? iso : null;
    };
    window.editChecklistTask = (existing = null, additions = {}, after = () => {}) => dialog(existing ? 'editTask' : 'addTask', (panel,close) => {
        const task = existing || additions, form = el('form','wheel-form'); panel.append(form);
        const title=field(form,'taskName','text',task.title || ''); title.required=true; title.maxLength=160;
        const schedule=el('div','checklist-schedule'); form.append(schedule);
        const makeEndpoint=(label,timeName,dateName,timeValue,dateValue)=>{
            const group=el('fieldset','checklist-endpoint');group.append(el('legend','',t(label)));
            const inputs=el('div','checklist-endpoint-inputs');group.append(inputs);schedule.append(group);
            const time=field(inputs,timeName,'text',timeValue);time.placeholder='HH:MM';time.pattern='([01][0-9]|2[0-3]):[0-5][0-9]';time.maxLength=5;time.inputMode='numeric';
            const date=field(inputs,dateName,'text',formatDate(dateValue));date.placeholder='dd/mm/yyyy';date.maxLength=10;date.inputMode='numeric';
            return {time,date};
        };
        const initialDate=task.start || task.fromDate || task.dates?.[0] || '';
        const initialMinutes=window.CalendarModel.minutes(task.fromTime);
        const finishMinutes=initialMinutes===null?null:initialMinutes+window.CalendarModel.duration(task);
        const first=makeEndpoint('startTime','fromTime','start',task.fromTime || '',initialDate);
        const last=makeEndpoint('endTime','endToTime','end',finishMinutes===null?'':window.CalendarModel.time(finishMinutes),finishMinutes===null?(task.toDate || initialDate):(initialDate?window.CalendarModel.addDays(initialDate,Math.floor(finishMinutes/1440)):''));
        const recurrence=el('fieldset','checklist-recurrence');recurrence.append(el('legend','',t('recurring')));form.append(recurrence);
        const base=task.start || task.fromDate || C.today();
        const selectedDays=new Set(task.repeat==='daily'?[1,2,3,4,5,6,0]:task.repeat==='weekdays'?[1,2,3,4,5]:task.repeat==='weekly'?(task.repeatDays?.length?task.repeatDays:[window.CalendarModel.day(base).getDay()]):[]);
        let recurrenceChanged=false;
        const dayButtons=[];
        const updateDays=()=>dayButtons.forEach(({node,day})=>{const active=day===null?!selectedDays.size&&(!task.repeat||recurrenceChanged):selectedDays.has(day);node.classList.toggle('active',active);node.setAttribute('aria-pressed',String(active));});
        for(const day of [null,1,2,3,4,5,6,0]) {
            const key=day===null?'noRepeat':(['CN','T2','T3','T4','T5','T6','T7'][day]);
            const node=button(key,()=>{recurrenceChanged=true;if(day===null)selectedDays.clear();else if(selectedDays.has(day))selectedDays.delete(day);else selectedDays.add(day);updateDays();});
            node.dataset.repeatDay=day===null?'none':String(day);recurrence.append(node);dayButtons.push({node,day});
        }
        updateDays();
        if(task.repeat==='monthly'||Number(task.repeatInterval)>1)recurrence.append(el('p','radar-muted',t('keepExistingRepeat')));
        let weight, cap;
        if (!task.seriesId && (task.wheelGoalId || additions.wheelGoalId)) {
            weight=field(form,'taskWeight','number',task.wheelWeight ?? 100); weight.required=true; weight.min=0; weight.max=100; weight.step='any';
            cap=field(form,'cap','number',task.wheelCap || 1); cap.required=true; cap.min=1; cap.max=1000000;
            const points=field(form,'pointsPerDone','number',10*Number(weight.value)/100/Number(cap.value));points.min=0;points.max=10;points.step='any';points.required=true;
            weight.oninput=cap.oninput=()=>{points.value=10*Number(weight.value)/100/Math.max(1,Number(cap.value));};
            points.oninput=()=>{weight.value=Number(points.value)*Math.max(1,Number(cap.value))*10;};
        }
        const error=el('p','task-editor-error'); error.setAttribute('role','alert'); form.append(error);
        const submit=button('save',()=>{}); submit.type='submit'; submit.classList.add('is-primary'); form.append(submit);
        form.onsubmit=event=>{
            event.preventDefault(); if (!title.value.trim()) return;
            const fromDate=parseDate(first.date.value), toDate=parseDate(last.date.value);
            const fromTime=first.time.value.trim(), endTime=last.time.value.trim();
            const repeat=recurrenceChanged || !existing ? (selectedDays.size?'weekly':'') : task.repeat || '';
            const repeatDays=[...selectedDays];
            if(fromDate===null || toDate===null){error.textContent=t('dateFormatError');return;}
            const M=window.CalendarModel, startMinutes=M.minutes(fromTime), endMinutes=M.minutes(endTime);
            if((repeat&&!fromDate)||(toDate&&!fromDate)||((fromTime||endTime)&&(!fromDate||!toDate||startMinutes===null||endMinutes===null))){error.textContent=t('scheduleFieldsError');return;}
            const duration=fromTime&&endTime ? M.daysBetween(fromDate,toDate)*1440+endMinutes-startMinutes : 0;
            if((toDate&&toDate<fromDate)||((fromTime||endTime)&&duration<=0)){error.textContent=t('invalidTaskEnd');return;}
            const state=C.load(), current=existing ? C.all(state).find(item=>item.id===existing.id) : null;
            const goalId=task.wheelGoalId || additions.wheelGoalId;
            if (weight && C.all(state).filter(item=>!item.trashedAt && !item.seriesId && item.wheelGoalId===goalId && item.id!==task.id).reduce((sum,item)=>sum+Number(item.wheelWeight||0),0)+Number(weight.value)>100+1e-8) { error.textContent=t('invalidWeight'); return; }
            const value={ ...current, ...additions, id:task.id || crypto.randomUUID(), kind:'task', title:title.value.trim(), fromDate, toDate:toDate || fromDate, dates:fromDate?[fromDate]:[], fromTime, endToTime:endTime, toTime:endTime, endFromTime:'', durationMinutes:duration, repeat, start:repeat?fromDate:'', repeatInterval:recurrenceChanged?1:task.repeatInterval || 1, repeatDays, repeatUntil:repeat?task.repeatUntil || '':'', completedDates:current?.completedDates || [] };
            const oldDate=current?.start || current?.fromDate || current?.dates?.[0];
            if(fromDate) {
                value.completed=false;
                if(oldDate && oldDate!==fromDate) {
                    const delta=window.CalendarModel.daysBetween(oldDate,fromDate);
                    for(const key of ['completedDates','excludedDates','extraDates'])if(value[key])value[key]=value[key].map(day=>window.CalendarModel.addDays(day,delta));
                    if(value.matrixDate)value.matrixDate=window.CalendarModel.addDays(value.matrixDate,delta);
                    if(value.repeatUntil)value.repeatUntil=window.CalendarModel.addDays(value.repeatUntil,delta);
                }
                if(current?.completed) value.completedDates=[...new Set([...value.completedDates,fromDate])];
            } else { value.completed=Boolean(current?.completed || current?.completedDates?.length);value.completedDates=[];value.excludedDates=[];value.extraDates=[]; }
            if (weight) Object.assign(value,{wheelWeight:Number(weight.value),wheelCap:Number(cap.value)});
            state.items=state.items.filter(item=>item.id!==value.id); state.recurring=state.recurring.filter(item=>item.id!==value.id);
            (value.repeat?state.recurring:state.items).push(value); C.commit(state); close(); after();
        };
    });
    window.setupChecklist = dashboard => {
        C.migrate();
        const panel=dashboard.querySelector('.todo-panel'); panel.classList.add('checklist-panel'); panel.replaceChildren();
        dashboard.querySelector('.weekly-panel')?.remove(); dashboard.querySelector('.planner-divider')?.remove();
        const header=el('div','dashboard-panel-heading');
        const trash=el('button','trash-open');trash.type='button';trash.dataset.checklistTrash='';trash.title=t('Thùng rác');trash.setAttribute('aria-label',t('Thùng rác'));trash.innerHTML=window.taskTrashIcon;trash.onclick=()=>window.showTaskTrash();
        header.append(el('h2','',t('checklist')),trash); panel.append(header);
        const toolbar=el('div','checklist-toolbar'); panel.append(toolbar);
        const view=select(toolbar,'checklist',['today','week','month','year','custom'],'today');
        const start=field(toolbar,'start','date',C.today()), end=field(toolbar,'end','date',C.today());
        const error=el('p','task-editor-error'); error.setAttribute('role','alert'); panel.append(error);
        const body=el('div'); panel.append(body);
        const row = (task,date,matrix=false) => {
            const node=el('article','todo-item'); node.dataset.checklistTask=task.id; node.dataset.date=date; node.draggable=true; node.classList.toggle('is-completed',C.done(task,date));
            node.classList.toggle('is-in-matrix',!matrix&&Boolean(task.matrixStatus));
            const check=el('input'); check.type='checkbox'; check.checked=C.done(task,date); check.setAttribute('aria-label',t('completion')+': '+task.title); check.onchange=()=>C.toggle(task.id,date,check.checked);
            const title=el('span','todo-item-title',task.title); title.dataset.userContent='';
            node.append(check,title);
            if (task.repeat || task.fromDate || task.dates?.length) node.append(el('small','',[task.fromTime,formatDate(date),task.endToTime?'– '+task.endToTime:''].filter(Boolean).join(' ')));
            node.append(button('edit',()=>window.editChecklistTask(task), '✎'));
            if (matrix) {const back=button('toChecklist',()=>C.update(task.id,item=>{item.matrixStatus=null;delete item.matrixDate;}),'×');back.dataset.returnChecklist='';node.append(back);}
            if (!matrix) node.append(button('remove',()=>C.update(task.id,item=>{item.trashedAt=new Date().toISOString();}),'×'));
            node.ondragstart=event=>{event.dataTransfer.effectAllowed='move';event.dataTransfer.setData('application/x-checklist-task',JSON.stringify({id:task.id,date}));};
            return node;
        };
        const render = () => {
            start.parentElement.hidden=view.value!=='custom'; end.parentElement.hidden=view.value!=='custom';
            if (view.value==='custom' && (!start.value || !end.value || end.value<start.value)) {error.textContent=t('invalidRange');return;} error.textContent='';
            const range=C.period(view.value,view.value==='custom'?start.value:C.today(),end.value), groups=C.groups(C.load(),range);
            body.replaceChildren(); header.querySelector('h2').textContent=t('checklist');
            for (const key of ['unscheduled','scheduled','recurring','previous']) {
                const group=el('section','todo-group'); group.dataset.checklistGroup=key;
                const heading=el('div','todo-group-heading');heading.append(el('h3','',t(key)),button('addTask',()=>{
                    const date=key==='previous'?range.previousEnd:range.start;
                    const defaults=key==='unscheduled'?{}:{fromDate:date,toDate:date};
                    if(key==='recurring')Object.assign(defaults,{repeat:'weekly',start:date,repeatDays:[window.CalendarModel.day(date).getDay()]});
                    window.editChecklistTask(null,defaults);
                },'+'));group.append(heading);
                if (!groups[key].length) group.append(el('p','radar-muted',t('empty')));
                groups[key].forEach(({task,date})=>group.append(row(task,date))); body.append(group);
            }
            dashboard.querySelectorAll('.matrix-dropzone').forEach(zone=>{
                zone.replaceChildren(); C.all().filter(task=>!task.trashedAt && task.kind!=='goal' && task.matrixStatus===zone.dataset.taskList).forEach(task=>zone.append(row(task,task.matrixDate || C.today(),true)));
            });
        };
        view.onchange=start.onchange=end.onchange=render;
        dashboard.addEventListener('dragover',event=>{if(event.target.closest('.matrix-dropzone,.checklist-panel')) {event.preventDefault();trash.classList.toggle('is-drag-over',Boolean(event.target.closest('[data-checklist-trash]')));}});
        dashboard.addEventListener('dragend',()=>trash.classList.remove('is-drag-over'));
        trash.addEventListener('dragleave',event=>{if(!trash.contains(event.relatedTarget))trash.classList.remove('is-drag-over');});
        dashboard.addEventListener('drop',event=>{
            const target=event.target.closest('[data-checklist-trash],.matrix-dropzone,.checklist-panel'); if(!target)return;
            const data=event.dataTransfer.getData('application/x-checklist-task'); if(!data)return;
            event.preventDefault();event.stopImmediatePropagation();
            trash.classList.remove('is-drag-over');
            try {const {id,date}=JSON.parse(data); C.update(id,task=>{if(target.hasAttribute('data-checklist-trash'))task.trashedAt=new Date().toISOString();else {task.matrixStatus=target.dataset.taskList || null;task.matrixDate=date;}});} catch {}
        },true);
        window.renderPlannerMatrix=()=>{};
        document.addEventListener('visualmind-dashboard-restored',()=>{if(C.migrate())document.dispatchEvent(new CustomEvent('visualmind-dashboard-restored'));render();});
        document.addEventListener('visualmind-dashboard-change',render);
        document.addEventListener('visualmind-preferences',render);
        render();
    };
})();
