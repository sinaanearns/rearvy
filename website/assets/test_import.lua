-- DaVinci Resolve API test
resolve = Resolve()
if resolve then
    print("DaVinci Resolve API connected!")
    pm = resolve:GetProjectManager()
    if pm then
        print("Project manager accessible")
        proj = pm:GetCurrentProject()
        if proj then
            print("Current project: " .. proj:GetName())
        else
            print("No current project - creating new one")
            ok, proj = pcall(function() return pm:CreateProject("Rearvy_45s_Promo") end)
            if ok and proj then
                print("Created project: " .. proj:GetName())
            else
                print("Could not create project")
            end
        end
    else
        print("No project manager")
    end
else
    print("Resolve() returned nil - API not accessible")
end
