/* Task forms share the wheel's category/goal IDs, editors and weight constraints. */
(() => {
    window.setupWheelTaskLink = (form, task) => {
        const W=window.WheelModel,C=window.ChecklistModel,{el,field,button,t}=window.DashboardUI;
        const section=el('fieldset','task-wheel-link');section.append(el('legend','',t('wheelLink')));form.append(section);
        const initialGoal=[...W.load().goals,...(W.load().archivedGoals||[])].find(goal=>goal.id===task.wheelGoalId);
        let categoryId=task.wheelCategoryId || initialGoal?.categoryId || '',goalId=task.wheelGoalId || '';
        const categoryRow=el('div','task-link-row');section.append(categoryRow);
        const category=field(categoryRow,'categories','select');category.name='wheelCategoryId';
        categoryRow.append(button('manageCategories',()=>window.WheelUI.settings(()=>refresh()),'⚙'));
        const goalRow=el('div','task-link-row');section.append(goalRow);
        const goal=field(goalRow,'goal','select');goal.name='wheelGoalId';
        const add=button('addGoal',()=>{
            const before=new Set(W.load().goals.map(item=>item.id));
            window.WheelUI.editGoal(category.value,null,()=>{goalId=W.load().goals.find(item=>!before.has(item.id))?.id || goalId;refresh();});
        },'+');
        const edit=button('editGoal',()=>{const current=W.load().goals.find(item=>item.id===goal.value);if(current)window.WheelUI.editGoal(current.categoryId,current,refresh);},'✎');
        const remove=button('archiveGoal',()=>W.archiveGoal(goal.value),'×');
        const restore=button('restoreGoal',()=>window.DashboardUI.dialog('restoreGoal',(panel,close)=>{
            const error=el('p','task-editor-error');error.setAttribute('role','alert');panel.append(error);
            for(const archived of W.load().archivedGoals||[])if(archived.categoryId===category.value)panel.append(button('restoreGoal',()=>{const message=W.restoreGoal(archived.id);if(message)error.textContent=message;else{goalId=archived.id;refresh();close();}},archived.title));
        }),'↶');
        goalRow.append(add,edit,remove,restore);
        const note=el('p','radar-muted',t('wheelLinkOptional'));section.append(note);
        const scoring=el('div','task-link-scoring');section.append(scoring);
        const weight=field(scoring,'taskWeight','number',task.wheelWeight ?? 100);weight.min=0;weight.max=100;weight.step='any';
        let automaticWeight=task.wheelWeight == null;
        weight.addEventListener('input',()=>{automaticWeight=false;});
        const remainingWeight=id=>Math.max(0,100-C.all().filter(item=>!item.trashedAt&&!item.seriesId&&item.wheelGoalId===id&&item.id!==task.id).reduce((sum,item)=>sum+Number(item.wheelWeight||0),0));
        const points=field(scoring,'pointsPerDone','number',W.pointsPerDone(task));points.min=0;points.max=10;points.step='any';
        const options=(input,items,selected)=>{input.replaceChildren();const none=el('option','',t('noSelection'));none.value='';input.append(none);for(const item of items){const option=el('option','',item.name);option.value=item.id;option.dataset.userContent='';input.append(option);}input.value=items.some(item=>item.id===selected)?selected:'';};
        const refresh=()=>{
            const wheel=W.load();
            const categories=[...wheel.categories,...(wheel.archivedCategories||[]).filter(item=>item.id===categoryId).map(item=>({...item,archived:true}))];
            options(category,categories.map(item=>({id:item.id,name:W.categoryName(item)+(item.archived?' · '+t('archived'):'')})),categoryId);categoryId=category.value;
            const goals=[...wheel.goals,...(wheel.archivedGoals||[]).filter(item=>item.id===goalId).map(item=>({...item,archived:true}))];
            options(goal,goals.filter(item=>item.categoryId===categoryId).map(item=>({id:item.id,name:item.title+(item.archived?' · '+t('archived'):'')})),goalId);goalId=goal.value;
            const activeCategory=wheel.categories.some(item=>item.id===categoryId),activeGoal=wheel.goals.some(item=>item.id===goalId);
            category.style.backgroundColor=wheel.categories.find(item=>item.id===categoryId)?W.categoryColor(wheel.categories.find(item=>item.id===categoryId)):'';category.style.color=category.style.backgroundColor?W.textColor(W.categoryColor(wheel.categories.find(item=>item.id===categoryId))):'';goal.disabled=!categoryId;add.disabled=!activeCategory;edit.disabled=!activeGoal||!activeCategory;remove.disabled=!activeGoal;restore.disabled=!activeCategory||!(wheel.archivedGoals||[]).some(item=>item.categoryId===categoryId);
            const linked=Boolean(categoryId&&goalId);scoring.hidden=!linked;note.textContent=t(linked&&(!activeCategory||!activeGoal)?'archivedLink':'wheelLinkOptional');
            if(linked&&automaticWeight)weight.value=remainingWeight(goalId);
            if(linked&&activeCategory&&activeGoal&&Number(weight.value)===0)note.textContent=t('zeroTaskWeight');
            for(const input of [weight,points]){input.disabled=!linked||Boolean(task.seriesId);input.required=linked&&!task.seriesId;}
        };
        category.onchange=()=>{categoryId=category.value;goalId='';refresh();};
        goal.onchange=()=>{goalId=goal.value;refresh();};
        refresh();
        const events=['visualmind-dashboard-change','visualmind-dashboard-restored','visualmind-preferences'];
        const changed=()=>{if(form.isConnected)refresh();else events.forEach(event=>document.removeEventListener(event,changed));};
        events.forEach(event=>document.addEventListener(event,changed));
        return {
            value:()=>({wheelCategoryId:category.value,wheelGoalId:category.value?goal.value:'',category:W.load().categories.find(item=>item.id===category.value)?W.categoryName(W.load().categories.find(item=>item.id===category.value)):'',wheelWeight:category.value&&goal.value?Number(weight.value):0,wheelPoints:Number(points.value)}),
            validate:()=>{
                if(!category.value||!goal.value)return '';
                if((W.load().archivedGoals||[]).some(item=>item.id===goal.value&&item.categoryId===category.value))return '';
                if(!W.load().goals.some(item=>item.id===goal.value&&item.categoryId===category.value))return t('invalidWheelLink');
                if(task.seriesId)return '';
                const others=C.all().filter(item=>!item.trashedAt&&!item.seriesId&&item.wheelGoalId===goal.value&&item.id!==task.id);
                if(!Number.isFinite(Number(weight.value))||Number(weight.value)<0||others.reduce((sum,item)=>sum+Number(item.wheelWeight||0),0)+Number(weight.value)>100+1e-8)return t('invalidWeight');
                if(!Number.isFinite(Number(points.value))||Number(points.value)<0||Number(points.value)>10)return t('invalidField');
                return '';
            }
        };
    };
})();
