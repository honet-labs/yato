import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Plug, Loader2, AlertCircle, HelpCircle } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";
import { cn } from "@/lib/utils";

interface IntegrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  editingIntegration: any | null;
}

export function IntegrationModal({ isOpen, onClose, editingIntegration }: IntegrationModalProps) {
  const queryClient = useQueryClient();
  const [selectedPluginKey, setSelectedPluginKey] = useState("");
  const [formData, setFormData] = useState({
    name: "",
    type: "PROVISIONING",
    endpointUrl: "",
    authKey: "",
    isActive: true
  });
  
  // Custom dynamic form values based on selected plugin fields
  const [dynamicValues, setDynamicValues] = useState({} as Record<string, string>);
  const [validationError, setValidationError] = useState("");

  // Fetch all available connector plugins
  const { data: plugins } = useQuery({
    queryKey: ["connector-plugins"],
    queryFn: async () => {
      const response = await api.get("/integrations/plugins");
      return response.data;
    },
    enabled: isOpen
  });

  // Find currently selected plugin template
  const activePlugin = plugins?.find(p => p.connectorKey === selectedPluginKey);

  useEffect(() => {
    if (editingIntegration) {
      setFormData({
        name: editingIntegration.name,
        type: editingIntegration.type,
        endpointUrl: editingIntegration.endpointUrl || "",
        authKey: editingIntegration.authKey || "",
        isActive: editingIntegration.isActive
      });
      setSelectedPluginKey(editingIntegration.connectorKey || "");
      setDynamicValues(editingIntegration.config || {});
      setValidationError("");
    } else {
      setFormData({
        name: "",
        type: "PROVISIONING",
        endpointUrl: "",
        authKey: "",
        isActive: true
      });
      setSelectedPluginKey("");
      setDynamicValues({});
      setValidationError("");
    }
  }, [editingIntegration, isOpen, plugins]);

  // Set default endpointUrl and dynamic field templates when selected plugin changes
  useEffect(() => {
    if (!editingIntegration && activePlugin) {
      setFormData(prev => ({
        ...prev,
        type: activePlugin.type,
        endpointUrl: activePlugin.connectorKey === 'proxmox-ve' ? 'https://localhost:8006' : 'http://localhost'
      }));
      
      const defaults: Record<string, string> = {};
      activePlugin.fields?.forEach((f: any) => {
        defaults[f.key] = "";
      });
      setDynamicValues(defaults);
    }
  }, [selectedPluginKey, activePlugin, editingIntegration]);

  const addMutation = useMutation({
    mutationFn: (data: any) => api.post("/integrations", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["integrations"] });
      onClose();
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => api.put(`/integrations/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["integrations"] });
      onClose();
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError("");

    if (!selectedPluginKey) {
      setValidationError("Please select a connector plugin template.");
      return;
    }

    // Validate that all required dynamic fields are filled
    if (activePlugin?.fields) {
      for (const field of activePlugin.fields) {
        if (field.required && !dynamicValues[field.key]) {
          setValidationError(`Field "${field.label}" is required.`);
          return;
        }
      }
    }

    const payload = {
      name: formData.name,
      type: formData.type,
      connectorKey: selectedPluginKey,
      endpointUrl: formData.endpointUrl,
      authKey: formData.authKey,
      isActive: formData.isActive,
      config: dynamicValues
    };

    if (editingIntegration) {
      updateMutation.mutate({ id: editingIntegration.id, data: payload });
    } else {
      addMutation.mutate(payload);
    }
  };

  const handleDynamicChange = (key: string, val: string) => {
    setDynamicValues(prev => ({
      ...prev,
      [key]: val
    }));
    setValidationError("");
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/40 backdrop-blur-sm">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="bg-white rounded-[2rem] shadow-2xl w-full max-w-2xl overflow-hidden border border-slate-100 flex flex-col max-h-[90vh]"
          >
            <div className="p-8 border-b border-slate-50 flex items-center justify-between bg-slate-50/50 shrink-0">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center shadow-xl shadow-blue-600/20">
                  <Plug className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-slate-900 tracking-tight">{editingIntegration ? 'Edit Connection' : 'Add Active Connection'}</h3>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Configure live connection from connector plugin</p>
                </div>
              </div>
              <button onClick={onClose} className="p-3 hover:bg-white rounded-2xl transition-all shadow-sm">
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            <div className="overflow-y-auto custom-scrollbar flex-1">
              <form id="integration-form" onSubmit={handleSubmit} className="p-8 space-y-6">
                
                {validationError && (
                  <div className="flex items-start gap-2.5 p-4 rounded-2xl bg-rose-50 border border-rose-100 text-rose-700 text-xs font-bold animate-pulse">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{validationError}</span>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-6">
                  
                  <div className="space-y-1.5 col-span-2">
                    <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Connection Name</label>
                    <input 
                      type="text" 
                      required
                      className="input-field w-full py-3.5"
                      placeholder="e.g. Jakarta Main Proxmox cluster"
                      value={formData.name}
                      onChange={e => setFormData({...formData, name: e.target.value})}
                    />
                  </div>

                  <div className="space-y-1.5 col-span-2">
                    <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Connector Plugin Template</label>
                    <select 
                      className="input-field w-full py-3.5 appearance-none bg-white font-bold"
                      value={selectedPluginKey}
                      onChange={e => setSelectedPluginKey(e.target.value)}
                      disabled={!!editingIntegration} // Prevent key modifications on edit
                    >
                      <option value="">-- Choose Plugin Connector --</option>
                      {plugins?.map((plugin) => (
                        <option key={plugin.connectorKey} value={plugin.connectorKey}>
                          {plugin.name} ({plugin.type})
                        </option>
                      ))}
                    </select>
                  </div>

                  {activePlugin && (
                    <>
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Type</label>
                        <input 
                          type="text" 
                          readOnly 
                          className="input-field w-full py-3.5 bg-slate-50 text-slate-500 font-bold"
                          value={formData.type}
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Endpoint URL</label>
                        <input 
                          type="text" 
                          required
                          className="input-field w-full py-3.5 font-mono text-sm"
                          placeholder="e.g. https://192.168.201.50:8006"
                          value={formData.endpointUrl}
                          onChange={e => setFormData({...formData, endpointUrl: e.target.value})}
                        />
                      </div>

                      {/* DYNAMIC FORM FIELDS GENERATED ON THE FLY */}
                      <div className="col-span-2 border-t border-slate-100 pt-6 mt-2 space-y-5">
                        <h4 className="text-xs font-bold text-slate-900 tracking-tight flex items-center gap-2">
                          <Plug className="w-4 h-4 text-blue-600" />
                          <span>CONNECTOR CONFIGURATION PARAMETERS</span>
                          <span className="text-[9px] font-bold text-blue-500 bg-blue-50 px-2 py-0.5 rounded-md uppercase tracking-wider ml-auto">Encrypted Vault</span>
                        </h4>

                        <div className="grid grid-cols-2 gap-5">
                          {activePlugin.fields?.map((field: any) => (
                            <div key={field.key} className={cn("space-y-1.5", field.type === 'textarea' ? 'col-span-2' : '')}>
                              <div className="flex justify-between">
                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                                  {field.label} {field.required && <span className="text-rose-500">*</span>}
                                </label>
                              </div>
                              
                              {field.type === 'textarea' ? (
                                <textarea
                                  required={field.required}
                                  placeholder={field.placeholder}
                                  className="input-field w-full h-24 font-mono text-xs py-3"
                                  value={dynamicValues[field.key] || ""}
                                  onChange={e => handleDynamicChange(field.key, e.target.value)}
                                />
                              ) : (
                                <input
                                  type={field.type || "text"}
                                  required={field.required}
                                  placeholder={field.placeholder}
                                  className="input-field w-full py-3 font-medium"
                                  value={dynamicValues[field.key] || ""}
                                  onChange={e => handleDynamicChange(field.key, e.target.value)}
                                />
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </form>
            </div>

            <div className="p-8 border-t border-slate-50 bg-slate-50/50 shrink-0">
              <button 
                type="submit" 
                form="integration-form"
                disabled={addMutation.isPending || updateMutation.isPending}
                className="btn-primary w-full py-4 flex items-center justify-center gap-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
              >
                {(addMutation.isPending || updateMutation.isPending) ? <Loader2 className="w-5 h-5 animate-spin" /> : <Plug className="w-5 h-5" />}
                <span>{editingIntegration ? 'Save Connection' : 'Add Connection'}</span>
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
