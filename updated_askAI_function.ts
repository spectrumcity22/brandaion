const askAI = async () => {
  if (!formData.url) {
    setError('Please enter a product URL first.');
    return;
  }

  setAiLoading(true);
  setError('');

  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      setError('User not authenticated.');
      return;
    }

    const requestData = {
      query: `Analyze this product: ${formData.url}`,
      product_name: formData.product_name || 'Unknown Product'
    };

    console.log('Sending to Perplexity:', requestData);

    const response = await fetch('https://ifezhvuckifvuracnnhl.supabase.co/functions/v1/perplexity_product_search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      },
      body: JSON.stringify(requestData)
    });

    console.log('Response status:', response.status);

    if (!response.ok) {
      let errorMessage = `HTTP ${response.status}: Failed to analyze product`;
      try {
        const errorData = await response.json();
        console.error('API Error:', errorData);
        errorMessage = errorData.error || errorMessage;
      } catch (parseError) {
        console.error('Could not parse error response:', parseError);
      }
      throw new Error(errorMessage);
    }

    const result = await response.json();
    console.log('API Result:', result);
    
    if (result.success) {
      // Store the structured response for display
      setAiResponse(result.data);
      
      console.log('AI Response data:', result.data);
      
      // Parse the simple text response from the analysis field
      let parsedFormData = {
        industry: '',
        targetAudience: '',
        valueProposition: '',
        mainFeatures: ''
      };

      if (result.data.analysis) {
        // Parse the simple text format: "industry: value\ntarget_audience: value\n..."
        const lines = result.data.analysis.trim().split('\n');
        lines.forEach((line: string) => {
          const trimmedLine = line.trim();
          if (trimmedLine.startsWith('industry:')) {
            parsedFormData.industry = trimmedLine.replace('industry:', '').trim();
          } else if (trimmedLine.startsWith('target_audience:')) {
            parsedFormData.targetAudience = trimmedLine.replace('target_audience:', '').trim();
          } else if (trimmedLine.startsWith('value_proposition:')) {
            parsedFormData.valueProposition = trimmedLine.replace('value_proposition:', '').trim();
          } else if (trimmedLine.startsWith('main_features:')) {
            parsedFormData.mainFeatures = trimmedLine.replace('main_features:', '').trim();
          }
        });
      }
      
      console.log('Setting form data:', parsedFormData);
      setAiFormData(parsedFormData);
      
      setSuccess('✅ AI analysis completed successfully! Review and save the results below.');
      
      // Save the analysis as JSON string to the products table if we have a product ID
      if (editingProduct?.id) {
        const { error: saveError } = await supabase
          .from('products')
          .update({
            ai_response: JSON.stringify(result.data)
          })
          .eq('id', editingProduct.id);
        
        if (saveError) {
          console.error('Failed to save analysis to database:', saveError);
          // Don't throw error here as the analysis was successful, just log it
        } else {
          console.log('Analysis saved to database successfully');
        }
      } else {
        // Store pending analysis for new products
        setPendingAnalysis(result.data);
      }
    } else {
      throw new Error(result.error || 'Analysis failed');
    }
  } catch (err: any) {
    console.error('AI Analysis Error:', err);
    setError(`❌ AI Analysis failed: ${err.message}`);
  } finally {
    setAiLoading(false);
  }
}; 