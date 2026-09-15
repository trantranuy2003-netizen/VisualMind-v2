(() => {
    const C = window.ChecklistModel, U = window.DashboardUI;
    const { el, button, dialog, field, select, t } = U;
    window.editChecklistTask = (existing = null, additions = {}, after = () => {}) => dialog('addTask', (panel,close) => {
        const task = existing || {}, form = el('form','wheel-form'); panel.append(form);
        const title=field(form,'taskName','text',task.title || ''); title.required=true; title.maxLength=160;
        const date=field(form,'start','date',task.start || task.fromDate || task.dates?.[0] || ''), end=field(form,'end','date',task.toDate || ''), time=field(form,'time','time',task.fromTime || '');
        const repeat=select(form,'repeat',['','daily','weekly','weekdays','monthly'],task.repeat);
        const interval=field(form,'interval','number',task.repeatInterval || 1); interval.min=1; interval.max=365; interval.required=true;
        const days=field(form,'repeatDays','text',(task.repeatDays || []).join(','));
        const until=field(form,'until','date',task.repeatUntil || '');
        const refresh = () => { date.required=Boolean(repeat.value || time.value); interval.parentElement.hidden=!repeat.value; days.parentElement.hidden=repeat.value!=='weekly'; until.parentElement.hidden=!repeat.value; };
        repeat.onchange=refresh; time.onchange=refresh; refresh();
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
            const repeatDays=days.value.trim() ? days.value.split(',').map(x=>Number(x.trim())) : [];
            if (repeat.value==='weekly' && repeatDays.some(x=>!Number.isInteger(x)||x<0||x>6)) { error.textContent=t('invalidDays'); return; }
            if ((end.value && (!date.value || end.value<date.value)) || (repeat.value && until.value && until.value<date.value)) { error.textContent=t('invalidRange'); return; }
            const state=C.load(), current=existing ? C.all(state).find(item=>item.id===existing.id) : null;
            const goalId=task.wheelGoalId || additions.wheelGoalId;
            if (weight && C.all(state).filter(item=>!item.trashedAt && !item.seriesId && item.wheelGoalId===goalId && item.id!==task.id).reduce((sum,item)=>sum+Number(item.wheelWeight||0),0)+Number(weight.value)>100+1e-8) { error.textContent=t('invalidWeight'); return; }
            const value={ ...current, ...additions, id:task.id || crypto.randomUUID(), kind:'task', title:title.value.trim(), fromDate:date.value, toDate:end.value || date.value, dates:date.value?[date.value]:[], fromTime:time.value, durationMinutes:time.value?Number(current?.durationMinutes)||60:0, repeat:repeat.value, start:repeat.value?date.value:'', repeatInterval:Number(interval.value), repeatDays:[...new Set(repeatDays)], repeatUntil:until.value, completedDates:current?.completedDates || [] };
            const oldDate=current?.start || current?.fromDate || current?.dates?.[0];
            if(date.value) {
                value.completed=false;
                if(oldDate && oldDate!==date.value) {
                    const delta=window.CalendarModel.daysBetween(oldDate,date.value);
                    for(const key of ['completedDates','excludedDates','extraDates'])if(value[key])value[key]=value[key].map(day=>window.CalendarModel.addDays(day,delta));
                    if(value.matrixDate)value.matrixDate=window.CalendarModel.addDays(value.matrixDate,delta);
                }
                if(current?.completed) value.completedDates=[...new Set([...value.completedDates,date.value])];
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
        const header=el('div','dashboard-panel-heading'); header.append(el('h2','',t('checklist')),button('Thùng rác',()=>window.showTaskTrash(),'↶'),button('addTask',()=>window.editChecklistTask(),'+')); panel.append(header);
        const toolbar=el('div','checklist-toolbar'); panel.append(toolbar);
        const view=select(toolbar,'checklist',['today','week','month','year','custom'],'today');
        const start=field(toolbar,'start','date',C.today()), end=field(toolbar,'end','date',C.today());
        const error=el('p','task-editor-error'); error.setAttribute('role','alert'); panel.append(error);
        const body=el('div'); panel.append(body);
        const row = (task,date,matrix=false) => {
            const node=el('article','todo-item'); node.dataset.checklistTask=task.id; node.dataset.date=date; node.draggable=true; node.classList.toggle('is-completed',C.done(task,date));
            const check=el('input'); check.type='checkbox'; check.checked=C.done(task,date); check.setAttribute('aria-label',t('completion')+': '+task.title); check.onchange=()=>C.toggle(task.id,date,check.checked);
            const title=el('span','todo-item-title',task.title); title.dataset.userContent='';
            node.append(check,title);
            if (task.repeat || task.fromDate || task.dates?.length) node.append(el('small','',date));
            node.append(button('edit',()=>window.editChecklistTask(task), '✎'));
            const move=el('select'); move.setAttribute('aria-label',t('matrix')); ['','do','schedule','delegate','eliminate'].forEach(value=>{const option=el('option','',t(value||'toChecklist')); option.value=value; move.append(option);}); move.value=task.matrixStatus || ''; move.onchange=()=>C.update(task.id,item=>{item.matrixStatus=move.value;item.matrixDate=date;}); node.append(move);
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
                const group=el('section','todo-group'); group.dataset.checklistGroup=key; group.append(el('h3','',t(key)));
                if (!groups[key].length) group.append(el('p','radar-muted',t('empty')));
                groups[key].forEach(({task,date})=>group.append(row(task,date))); body.append(group);
            }
            dashboard.querySelectorAll('.matrix-dropzone').forEach(zone=>{
                zone.replaceChildren(); C.all().filter(task=>!task.trashedAt && task.kind!=='goal' && task.matrixStatus===zone.dataset.taskList).forEach(task=>zone.append(row(task,task.matrixDate || C.today(),true)));
            });
        };
        view.onchange=start.onchange=end.onchange=render;
        dashboard.addEventListener('dragover',event=>{if(event.target.closest('.matrix-dropzone,.checklist-panel')) event.preventDefault();});
        dashboard.addEventListener('drop',event=>{
            const target=event.target.closest('.matrix-dropzone,.checklist-panel'); if(!target)return;
            const data=event.dataTransfer.getData('application/x-checklist-task'); if(!data)return;
            event.preventDefault();event.stopImmediatePropagation();
            try {const {id,date}=JSON.parse(data); C.update(id,task=>{task.matrixStatus=target.dataset.taskList || null;task.matrixDate=date;});} catch {}
        },true);
        window.renderPlannerMatrix=()=>{};
        document.addEventListener('visualmind-dashboard-restored',()=>{if(C.migrate())document.dispatchEvent(new CustomEvent('visualmind-dashboard-restored'));render();});
        document.addEventListener('visualmind-dashboard-change',render);
        document.addEventListener('visualmind-preferences',render);
        render();
    };
})();
